import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sun,
  Moon,
  Copy,
  Check,
  Trash2,
  Wand2,
  Loader2,
  Play,
  Share2,
  Undo2,
  Redo2,
  Settings,
} from 'lucide-react'
import { type ThemeMode } from './lib/theme'
import { CodeEditor } from './components/CodeEditor'
import { Console, type ConsoleMessage } from './components/Console'
import { OverrideModal } from './components/Modal'
import {
  PackageManager,
  type InstalledPackage,
} from './components/PackageManager'
import { Button } from './components/ui/Button'
import { IconButton } from './components/ui/IconButton'
import { syncNodeModulesToWorker } from './lib/typings'
import { decodeSharePayload, encodeSharePayload } from './lib/shareCodec'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { formatAllFiles, loadPrettier } from './lib/formatter'
import { workerClient } from './lib/workerClient'
import { writeFiles, runCommand, getWebContainer } from './lib/webcontainer'

const DEFAULT_TS = `// TypeScript Playground
// Long-press any word on mobile to see type info ✨

interface User {
  name: string;
  age: number;
  email?: string;
}

/**
 * Greets a user with a personalised message.
 * @param user The user to greet
 */
function greet(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

const alice: User = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
};

const message = greet(alice);
console.log(message);

// Generics
function identity<T>(value: T): T {
  return value;
}

const result = identity<number>(42);
console.log("Identity:", result);

// Async / await
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}

console.log("Type:", typeof fetchData);
`

const DEFAULT_TSCONFIG = `{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}`

// ── Custom Hooks (Kent C. Dodds Style Refactoring) ────────────────────────────

function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const [consoleOpen, setConsoleOpen] = useState(true)

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      if (
        type === 'error' &&
        args.some(
          (a) =>
            typeof a === 'string' && a.includes('Maximum update depth exceeded')
        )
      ) {
        return
      }

      const formatted = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a, null, 2)
        } catch {
          return String(a)
        }
      })
      setMessages((previous) =>
        [...previous, { type, args: formatted, ts: Date.now() }].slice(-500)
      )
    },
    []
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    setConsoleOpen((o) => !o)
  }, [])

  useEffect(() => {
    const origLog = console.log
    const origError = console.error
    const origWarn = console.warn
    const origInfo = console.info
    const origDebug = console.debug
    const origTrace = console.trace
    const origDir = console.dir

    console.log = (...a) => {
      addMessage('log', a)
      origLog(...a)
    }

    console.error = (...a) => {
      addMessage('error', a)
      origError(...a)
    }

    console.warn = (...a) => {
      addMessage('warn', a)
      origWarn(...a)
    }

    console.info = (...a) => {
      addMessage('info', a)
      origInfo(...a)
    }

    console.debug = (...a) => {
      addMessage('debug', a)
      origDebug(...a)
    }

    console.trace = (...a) => {
      addMessage('trace', a)
      origTrace(...a)
    }

    console.dir = (...a) => {
      addMessage('dir', a)
      origDir(...a)
    }

    return () => {
      console.log = origLog
      console.error = origError
      console.warn = origWarn
      console.info = origInfo
      console.debug = origDebug
      console.trace = origTrace
      console.dir = origDir
    }
  }, [addMessage])

  return { messages, addMessage, clearMessages, consoleOpen, toggleConsole }
}

function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    workerClient
      .init()
      .then(() => {
        setCompilerStatus('ready')
      })
      .catch((error) => {
        console.error('Worker init failed:', error)
        setCompilerStatus('error')
      })
  }, [])

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {
        /* Silent */
      })
    }
  }, [compilerStatus])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      setIsRunning(true)
      try {
        const compiled = await workerClient.compile(tsCode)
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({
          'index.js': compiled.js,
        })

        // Wait for any background npm installs/uninstalls to finish
        await pendingInstalls

        addMessage('info', ['Executing via Node.js...'])
        const exitCode = await runCommand('node', ['index.js'], (out) => {
          const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
          if (clean) addMessage('log', [clean])
        })

        if (exitCode !== 0) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
      } catch (error) {
        onError(error as Error)
      } finally {
        setIsRunning(false)
      }
    },
    [tsCode, addMessage]
  )

  return { compilerStatus, isRunning, runCode }
}

// ── App ───────────────────────────────────────────────────────────────────────
export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('mocha')

  // Toggle dark mode class on HTML element
  useEffect(() => {
    if (themeMode === 'mocha') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [themeMode])

  // Initialize state from localStorage or fallback to defaults
  const [tsCode, setTsCode] = useState(
    () => localStorage.getItem('tsplay_ts') ?? DEFAULT_TS
  )
  const [jsCode, setJsCode] = useState(
    () =>
      localStorage.getItem('tsplay_js') ??
      '// Press Run to compile TypeScript →'
  )
  const [dtsCode, setDtsCode] = useState(
    () =>
      localStorage.getItem('tsplay_dts') ??
      '// .d.ts declarations will appear here'
  )
  const [activeTab, setActiveTab] = useState<'ts' | 'js' | 'dts'>('ts')

  const [tsConfigString, setTsConfigString] = useState(
    () => localStorage.getItem('tsplay_tsconfig') ?? DEFAULT_TSCONFIG
  )
  const [temporaryTsConfig, setTemporaryTsConfig] = useState(tsConfigString)

  // Persist code to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tsplay_ts', tsCode)
  }, [tsCode])
  useEffect(() => {
    localStorage.setItem('tsplay_js', jsCode)
  }, [jsCode])
  useEffect(() => {
    localStorage.setItem('tsplay_dts', dtsCode)
  }, [dtsCode])
  useEffect(() => {
    localStorage.setItem('tsplay_tsconfig', tsConfigString)
  }, [tsConfigString])

  // Send tsconfig to worker whenever it changes
  useEffect(() => {
    workerClient.updateConfig(tsConfigString).catch(console.error)
  }, [tsConfigString])

  const [jsDirty, setJsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [installedPackages, setInstalledPackages] = useState<
    InstalledPackage[]
  >([])
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>(
    {}
  )

  const previousPkgsRef = useRef<Set<string>>(new Set())
  const installQueue = useRef<Promise<void>>(Promise.resolve())

  const [panelHeight, setPanelHeight] = useState(180)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const [packageManagerOpen, setPackageManagerOpen] = useState(false)
  const { keyboardOpen, keyboardHeight, isMobileLike } = useVirtualKeyboard()
  const compactForKeyboard = keyboardOpen && isMobileLike

  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formatSuccess, setFormatSuccess] = useState(false)

  const swipeRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)

  // Custom Hooks
  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager()
  const { compilerStatus, isRunning, runCode } = useCompilerManager(
    tsCode,
    addMessage
  )

  // Global Keyboard Shortcuts (Tab Switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'INPUT'

      // Switch tabs with ArrowLeft/ArrowRight.
      // If focused in an editor, require Alt key to prevent breaking text navigation.
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        (!isInput || e.altKey)
      ) {
        e.preventDefault()
        setActiveTab((previous) => {
          const tabs: Array<'ts' | 'js' | 'dts'> = ['ts', 'js', 'dts']
          const idx = tabs.indexOf(previous)
          if (e.key === 'ArrowLeft') {
            return tabs[(idx - 1 + tabs.length) % tabs.length]
          }

          return tabs[(idx + 1) % tabs.length]
        })
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Initialize base package.json for WebContainer
  useEffect(() => {
    getWebContainer().then(async (instance) => {
      try {
        await instance.fs.readFile('package.json', 'utf8')
      } catch {
        await instance.fs.writeFile(
          'package.json',
          JSON.stringify({ name: 'playground', type: 'module' }, null, 2)
        )
      }
    })
  }, [])

  // Auto-detect imports via Worker
  const tsCursorPos = useRef(0)
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    null
  )

  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current)
    checkImportsTimeout.current = setTimeout(async () => {
      const lines = tsCode.split('\n')
      const cursorLineIdx =
        tsCode.slice(0, tsCursorPos.current).split('\n').length - 1
      const currentLine = lines[cursorLineIdx] || ''

      // Delay detection if the user is actively editing an import line
      if (/\bimport\b/.test(currentLine)) {
        return
      }

      try {
        const detected = await workerClient.detectImports(tsCode)
        setInstalledPackages((previous) => {
          const previousNames = previous
            .map((p) => p.name)
            .sort()
            .join(',')
          const newNames = [...detected].sort().join(',')
          if (previousNames === newNames) return previous
          return detected.map((name) => ({ name, version: 'latest' }))
        })
      } catch (error) {
        console.error('Failed to detect imports:', error)
      }
    }, 500)
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  // Background NPM Install/Uninstall Queue
  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name))
    const previousNames = previousPkgsRef.current

    const added = [...currentNames].filter((x) => !previousNames.has(x))
    const removed = [...previousNames].filter((x) => !currentNames.has(x))

    if (added.length === 0 && removed.length === 0) return

    previousPkgsRef.current = currentNames

    if (added.length > 0) {
      installQueue.current = installQueue.current
        .then(async () => {
          addMessage('info', [`npm install ${added.join(' ')}...`])
          const code = await runCommand(
            'npm',
            ['install', '--no-progress', ...added],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean])
            }
          )
          if (code === 0) {
            const libs = await syncNodeModulesToWorker()
            setPackageTypings(libs)
          } else {
            addMessage('error', [`npm install failed with code ${code}`])
          }
        })
        .catch((error) => {
          addMessage('error', [`npm install error: ${error.message}`])
        })
    }

    if (removed.length > 0) {
      installQueue.current = installQueue.current
        .then(async () => {
          addMessage('info', [`npm uninstall ${removed.join(' ')}...`])
          const code = await runCommand(
            'npm',
            ['uninstall', '--no-progress', ...removed],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean])
            }
          )
          if (code === 0) {
            const libs = await syncNodeModulesToWorker()
            setPackageTypings(libs)
          } else {
            addMessage('error', [`npm uninstall failed with code ${code}`])
          }
        })
        .catch((error) => {
          addMessage('error', [`npm uninstall error: ${error.message}`])
        })
    }
  }, [installedPackages, addMessage])

  const getApiCandidates = useCallback((path: string) => {
    const normalized = path.replace(/^\/+/, '')
    const base = new URL(document.baseURI || globalThis.location.href)
    const currentDir = new URL('./', globalThis.location.href)
    const candidates = [
      new URL(normalized, base).toString(),
      new URL(normalized, currentDir).toString(),
      `${globalThis.location.origin}/${normalized}`,
    ]
    return [...new Set(candidates)]
  }, [])

  const fetchApiJson = useCallback(
    async (path: string, init?: RequestInit) => {
      const candidates = getApiCandidates(path)
      let lastError: Error | undefined = undefined

      for (const url of candidates) {
        try {
          const res = await fetch(url, init)
          const text = await res.text()
          let data: any = undefined
          try {
            data = JSON.parse(text)
          } catch {
            const preview = text.slice(0, 300).replaceAll('\n', ' ')
            if (!res.ok) {
              lastError = new Error(
                `Share API failed (${res.status} ${res.statusText}) at ${url}. Raw response: ${preview}...`
              )
              continue
            }

            lastError = new Error(
              `Share API returned invalid JSON at ${url}. Raw response: ${preview}...`
            )
            continue
          }

          if (!res.ok) {
            lastError = new Error(
              data?.error || `Share API failed (${res.status}).`
            )
            continue
          }

          return data
        } catch (error) {
          lastError = error as Error
        }
      }

      throw (
        lastError ??
        new Error(
          'Share service unavailable. Ensure the PHP API is served correctly.'
        )
      )
    },
    [getApiCandidates]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!consoleOpen && !packageManagerOpen) return
      e.preventDefault()
      setIsResizing(true)
      resizeStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY
      resizeStartHeight.current = panelHeight
    },
    [panelHeight, consoleOpen, packageManagerOpen]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const deltaY = resizeStartY.current - clientY
      const newHeight = Math.max(
        80,
        Math.min(400, resizeStartHeight.current + deltaY)
      )
      setPanelHeight(newHeight)
    },
    [isResizing]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      globalThis.addEventListener('mousemove', handleResizeMove)
      globalThis.addEventListener('mouseup', handleResizeEnd)
      globalThis.addEventListener('touchmove', handleResizeMove, {
        passive: false,
      })
      globalThis.addEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      globalThis.removeEventListener('mousemove', handleResizeMove)
      globalThis.removeEventListener('mouseup', handleResizeEnd)
      globalThis.removeEventListener('touchmove', handleResizeMove)
      globalThis.removeEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  const getApiUrl = useCallback((path: string) => {
    return new URL(path.replace(/^\//, ''), document.baseURI).toString()
  }, [])

  const parseJsonResponse = useCallback(async (res: Response) => {
    const text = await res.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      const preview = text.slice(0, 300).replaceAll('\n', ' ')
      throw new Error(
        res.ok
          ? `Share API returned invalid JSON. Raw response: ${preview}...`
          : `Share API failed (${res.status}). Raw response: ${preview}...`
      )
    }

    if (!res.ok) {
      throw new Error(data?.error || `Request failed with status ${res.status}`)
    }

    return data
  }, [])

  useEffect(() => {
    const parameters = new URLSearchParams(globalThis.location.search)
    const embedded =
      parameters.get('code') || globalThis.location.hash.replace(/^#code=/, '')
    if (embedded) {
      decodeSharePayload(embedded)
        .then((payload) => {
          setTsCode(payload.tsCode || '')
          setJsCode(payload.jsCode || '')
          addMessage('info', [
            'Loaded embedded share link (client-side, no server storage).',
          ])
        })
        .catch((error) => {
          addMessage('error', [
            `Failed to load embedded share link: ${error.message}`,
          ])
        })
      return
    }

    const shareId = parameters.get('share')
    if (shareId) {
      fetch(getApiUrl(`api/get.php?id=${encodeURIComponent(shareId)}`))
        .then(parseJsonResponse)
        .then((data) => {
          if (data.success) {
            setTsCode(data.tsCode)
            if (data.jsCode) setJsCode(data.jsCode)
            addMessage('info', [
              `✓ Loaded shared snippet (${data.remainingDays} days remaining)`,
            ])
            const url = new URL(globalThis.location.href)
            url.searchParams.delete('share')
            globalThis.history.replaceState({}, '', url.toString())
            return
          }

          addMessage('error', [`Failed to load shared snippet: ${data.error}`])
        })
        .catch((error) => {
          addMessage('error', [
            `Failed to load shared snippet: ${error.message}`,
          ])
        })
    }
  }, [addMessage, fetchApiJson, getApiUrl, parseJsonResponse])

  const handleCopyAll = useCallback(() => {
    const code =
      activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, 1500)
      })
      .catch(() => {
        const ta = document.createElement('textarea')
        ta.value = code
        document.body.append(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, 1500)
      })
  }, [activeTab, tsCode, jsCode, dtsCode])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') {
      setTsCode('')
    } else if (activeTab === 'js') {
      setJsCode('')
      setJsDirty(false)
    } else {
      setDtsCode('')
    }
  }, [activeTab])

  const handleFormat = useCallback(async () => {
    setFormatting(true)
    try {
      const {
        tsCode: fTs,
        jsCode: fJs,
        dtsCode: fDts,
        errors,
      } = await formatAllFiles(tsCode, jsCode, dtsCode)
      setTsCode(fTs)
      setJsCode(fJs)
      setDtsCode(fDts)
      if (errors.length > 0) {
        addMessage('warn', [`Format had issues: ${errors.join(', ')}`])
      } else {
        setFormatSuccess(true)
        addMessage('info', ['✓ All files formatted with Prettier'])
        setTimeout(() => {
          setFormatSuccess(false)
        }, 1500)
      }
    } catch (error) {
      addMessage('error', [`Format failed: ${(error as Error).message}`])
    } finally {
      setFormatting(false)
    }
  }, [tsCode, jsCode, dtsCode, addMessage])

  const doRun = useCallback(
    async (skipDirtyCheck = false) => {
      if (!skipDirtyCheck && jsDirty) {
        setShowModal(true)
        return
      }

      setShowModal(false)
      clearMessages()

      runCode(
        installQueue.current,
        (js, dts) => {
          setJsCode(js)
          setDtsCode(dts)
          setJsDirty(false)
        },
        (error) => {
          addMessage('error', [`Compilation error: ${error.message}`])
        }
      )
    },
    [jsDirty, runCode, clearMessages, addMessage]
  )

  const isEditorTarget = (target: EventTarget | undefined) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('textarea'))
  }

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (compactForKeyboard) return
      if (isEditorTarget(e.target)) return
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      swiping.current = false
    },
    [compactForKeyboard]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (compactForKeyboard) return
      if (isEditorTarget(e.target)) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        swiping.current = true
      }

      if (swiping.current) e.preventDefault()
    },
    [compactForKeyboard]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (compactForKeyboard) return
      if (isEditorTarget(e.target)) return
      if (!swiping.current) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (Math.abs(dx) < 40) return

      const tabs: Array<'ts' | 'js' | 'dts'> = ['ts', 'js', 'dts']
      const currentIndex = tabs.indexOf(activeTab)

      if (dx < 0) {
        const nextIndex = (currentIndex + 1) % tabs.length
        setActiveTab(tabs[nextIndex])
      } else {
        const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length
        setActiveTab(tabs[previousIndex])
      }

      swiping.current = false
    },
    [activeTab, compactForKeyboard]
  )

  const togglePackageManager = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    setPackageManagerOpen((o) => !o)
  }, [])

  const statusLabel =
    compilerStatus === 'loading'
      ? '⏳ Loading…'
      : compilerStatus === 'error'
        ? '✗ No compiler'
        : '✓ TS ready'
  const statusColorClass =
    compilerStatus === 'ready'
      ? 'text-green'
      : compilerStatus === 'error'
        ? 'text-red'
        : 'text-yellow'

  return (
    <div className='flex flex-col h-[100dvh] bg-base text-text font-sans overflow-hidden'>
      {/* ── Header ── */}
      <header className='flex items-center justify-between px-1.5 h-9 bg-mantle border-b border-surface0 shrink-0 gap-1 relative z-40'>
        {/* Brand */}
        <div className='flex items-center gap-2'>
          <span className='text-xs font-bold tracking-tight font-mono'>
            TS<span className='text-mauve'>Play</span>
          </span>
        </div>

        {/* Tabs */}
        <div className='flex bg-surface0 rounded-[5px] p-[1px] gap-[1px] shrink'>
          {(['ts', 'js', 'dts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
              }}
              className={`px-1.5 py-0.5 rounded border-none text-[9px] font-semibold font-mono cursor-pointer tracking-wide uppercase transition-all duration-160 ${
                activeTab === tab
                  ? 'bg-mauve/20 text-mauve'
                  : 'bg-transparent text-overlay1'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className='flex items-center gap-1 shrink-0'>
          {/* Theme toggle */}
          <IconButton
            onClick={() => {
              setThemeMode((m) => (m === 'mocha' ? 'latte' : 'mocha'))
            }}
            title={
              themeMode === 'mocha'
                ? 'Switch to Latte (light)'
                : 'Switch to Mocha (dark)'
            }
            size='sm'
            variant='surface'
            className='w-[22px] h-[22px] p-0'
          >
            {themeMode === 'mocha' ? <Sun size={14} /> : <Moon size={14} />}
          </IconButton>

          {/* Separator */}
          <div className='w-px h-2.5 bg-surface1 shrink-0' />

          {/* Copy all */}
          <IconButton
            onClick={handleCopyAll}
            title={`Copy all ${activeTab}`}
            size='sm'
            variant='surface'
            className={`w-[22px] h-[22px] p-0 ${copied ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>

          {/* Delete all */}
          <IconButton
            onClick={handleDeleteAll}
            title={`Clear ${activeTab} editor`}
            size='sm'
            variant='surface'
            className='w-[22px] h-[22px] p-0 text-red hover:text-red'
          >
            <Trash2 size={14} />
          </IconButton>

          {/* Format */}
          <IconButton
            onClick={handleFormat}
            disabled={formatting}
            title='Format all files with Prettier (TS + JS + DTS)'
            size='sm'
            variant='surface'
            className={`w-[22px] h-[22px] p-0 ${formatSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
          >
            {formatting ? (
              <Loader2
                size={14}
                className='animate-spin'
              />
            ) : formatSuccess ? (
              <Check size={14} />
            ) : (
              <Wand2 size={14} />
            )}
          </IconButton>

          {/* Separator */}
          <div className='w-px h-2.5 bg-surface1 shrink-0' />

          {/* Run */}
          <Button
            onClick={async () => doRun(false)}
            disabled={isRunning || compilerStatus !== 'ready'}
            variant='primary'
            title='Run (compile + execute)'
            className='font-mono tracking-wide px-2 py-0 h-[22px] min-w-[22px] text-[10px] gap-1.5'
          >
            {isRunning ? (
              <Loader2
                size={12}
                className='animate-spin'
              />
            ) : (
              <Play
                size={12}
                fill='currentColor'
              />
            )}
            <span className='hidden sm:inline'>
              {isRunning ? 'Running…' : 'Run'}
            </span>
          </Button>

          {/* Separator */}
          <div className='w-px h-2.5 bg-surface1 shrink-0' />

          {/* Share */}
          <IconButton
            onClick={async () => {
              setSharing(true)
              try {
                const data = await fetchApiJson('api/share.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tsCode,
                    jsCode,
                    packages: installedPackages,
                  }),
                })
                if (data.success) {
                  const url = new URL(globalThis.location.href)
                  url.searchParams.set('share', data.id)
                  url.searchParams.delete('code')
                  url.hash = ''
                  const shareUrl = url.toString()
                  await navigator.clipboard.writeText(shareUrl)
                  setShareSuccess(true)
                  addMessage('info', [
                    `✓ Share link copied! Expires in ${data.ttlDays ?? data.expires ?? 7} days`,
                  ])
                  setTimeout(() => {
                    setShareSuccess(false)
                  }, 2000)
                } else {
                  throw new Error(data.error || 'Share API returned an error')
                }
              } catch (error) {
                try {
                  const token = await encodeSharePayload({
                    tsCode,
                    jsCode,
                    packages: installedPackages,
                  })
                  const url = new URL(globalThis.location.href)
                  url.searchParams.delete('share')
                  url.searchParams.delete('code')
                  url.hash = `code=${token}`
                  await navigator.clipboard.writeText(url.toString())
                  setShareSuccess(true)
                  addMessage('warn', [
                    `PHP share unavailable: ${(error as Error).message}`,
                    'Copied embedded compressed link instead. It is stored in the URL itself and has no 7-day TTL.',
                  ])
                  setTimeout(() => {
                    setShareSuccess(false)
                  }, 2000)
                } catch (error) {
                  addMessage('error', [
                    `Failed to share: ${(error as Error).message}`,
                  ])
                }
              } finally {
                setSharing(false)
              }
            }}
            title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
            tooltipAlign='right'
            size='sm'
            variant='surface'
            disabled={sharing}
            className={`w-[22px] h-[22px] p-0 ${shareSuccess ? 'text-green border-green bg-green/15 hover:bg-green/20' : ''}`}
          >
            {sharing ? (
              <Loader2
                size={14}
                className='animate-spin'
              />
            ) : shareSuccess ? (
              <Check size={14} />
            ) : (
              <Share2 size={14} />
            )}
          </IconButton>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div
        className='grid grid-cols-3 items-center px-3.5 bg-crust border-b border-surface0 shrink-0 relative z-30'
        style={{ height: compactForKeyboard ? 20 : 24 }}
      >
        <div className='flex items-center justify-start min-w-0'>
          <span
            className={`text-[10px] font-mono tracking-wide truncate ${statusColorClass}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className='flex items-center justify-center min-w-0'>
          <span className='text-[10px] text-overlay0 font-mono truncate'>
            {activeTab === 'ts'
              ? 'TypeScript'
              : activeTab === 'js'
                ? 'JavaScript'
                : 'Declarations'}
            {activeTab === 'js' && jsDirty && (
              <span className='ml-1.5 text-peach'>● modified</span>
            )}
          </span>
        </div>

        <div className='flex items-center justify-end gap-1 min-w-0'>
          <IconButton
            onClick={() => document.execCommand('undo')}
            title='Undo'
            tooltipAlign='center'
            size='sm'
            variant='ghost'
            className='w-[20px] h-[20px] p-0 text-overlay1 hover:text-text shrink-0'
          >
            <Undo2 size={12} />
          </IconButton>
          <IconButton
            onClick={() => document.execCommand('redo')}
            title='Redo'
            tooltipAlign='center'
            size='sm'
            variant='ghost'
            className='w-[20px] h-[20px] p-0 text-overlay1 hover:text-text shrink-0'
          >
            <Redo2 size={12} />
          </IconButton>
          <div className='w-px h-2.5 bg-surface1 mx-0.5 shrink-0' />
          <IconButton
            onClick={() => {
              setTemporaryTsConfig(tsConfigString)
              setShowSettings(true)
            }}
            title='Settings'
            tooltipAlign='right'
            size='sm'
            variant='ghost'
            className='w-[20px] h-[20px] p-0 text-overlay1 hover:text-text shrink-0'
          >
            <Settings size={12} />
          </IconButton>
        </div>
      </div>

      {/* ── Editors ── */}
      <div
        ref={swipeRef}
        className='flex-1 overflow-hidden relative min-h-0'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slider track */}
        <div
          className='flex w-[300%] h-full transition-transform duration-300 ease-in-out will-change-transform'
          style={{
            transform:
              activeTab === 'ts'
                ? 'translateX(0)'
                : activeTab === 'js'
                  ? 'translateX(-33.333%)'
                  : 'translateX(-66.666%)',
          }}
        >
          {/* TS Editor */}
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              value={tsCode}
              onChange={setTsCode}
              onCursorChange={(pos) => {
                tsCursorPos.current = pos
                checkImports()
              }}
              language='typescript'
              extraLibs={packageTypings}
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
          {/* JS Editor */}
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              value={jsCode}
              onChange={(v) => {
                setJsCode(v)
                setJsDirty(true)
              }}
              language='javascript'
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
          {/* DTS Editor */}
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              value={dtsCode}
              onChange={setDtsCode}
              language='typescript'
              readOnly={true}
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
        </div>
      </div>

      {/* ── Resize Divider ── */}
      {!compactForKeyboard && (consoleOpen || packageManagerOpen) && (
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className={`h-2 border-b border-surface1 cursor-ns-resize flex items-center justify-center shrink-0 transition-colors duration-160 relative ${isResizing ? 'bg-peach' : 'bg-surface0'}`}
          title='Drag to resize'
        >
          <div className='w-10 h-1 bg-overlay0 rounded-sm opacity-50' />
        </div>
      )}

      {/* ── Console & Package Manager Section ── */}
      {!compactForKeyboard && (
        <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
          {/* ── Console ── */}
          <Console
            messages={messages}
            onClear={clearMessages}
            isOpen={consoleOpen}
            onToggle={toggleConsole}
            contentHeight={panelHeight}
          />

          {/* ── Package Manager ── */}
          <PackageManager
            packages={installedPackages}
            isOpen={packageManagerOpen}
            onToggle={togglePackageManager}
            contentHeight={panelHeight}
          />
        </div>
      )}

      {/* ── Override modal ── */}
      {showModal && (
        <OverrideModal
          onConfirm={async () => doRun(true)}
          onCancel={() => {
            setShowModal(false)
          }}
        />
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-sm p-4'>
          <div className='bg-mantle border border-surface1 rounded-lg shadow-xl w-full max-w-[400px] flex flex-col overflow-hidden'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-surface0 bg-base'>
              <h2 className='text-sm font-bold text-text'>Settings</h2>
              <IconButton
                onClick={() => {
                  setShowSettings(false)
                }}
                size='sm'
                variant='ghost'
                className='w-6 h-6 p-0'
              >
                <span className='text-lg leading-none'>&times;</span>
              </IconButton>
            </div>
            <div className='p-4 flex flex-col gap-4'>
              <div className='flex flex-col gap-1.5'>
                <label className='text-xs font-bold text-subtext0'>
                  TypeScript Version
                </label>
                <select className='bg-surface0 border border-surface1 rounded px-2 py-1.5 text-sm text-text outline-none focus:border-mauve'>
                  <option>5.9.3 (Default)</option>
                  <option>5.8.2</option>
                  <option>5.7.3</option>
                </select>
              </div>
              <div className='flex flex-col gap-1.5'>
                <label className='text-xs font-bold text-subtext0'>
                  tsconfig.json
                </label>
                <textarea
                  className='bg-surface0 border border-surface1 rounded px-2 py-1.5 text-sm text-text outline-none focus:border-mauve font-mono resize-y min-h-[120px]'
                  value={temporaryTsConfig}
                  onChange={(e) => {
                    setTemporaryTsConfig(e.target.value)
                  }}
                  spellCheck={false}
                />
                {(() => {
                  try {
                    JSON.parse(temporaryTsConfig)
                    return null
                  } catch {
                    return (
                      <span className='text-[10px] text-red'>
                        Invalid JSON. Fallback config will be used.
                      </span>
                    )
                  }
                })()}
              </div>
            </div>
            <div className='flex items-center justify-end gap-2 px-4 py-3 border-t border-surface0 bg-base'>
              <Button
                onClick={() => {
                  setShowSettings(false)
                }}
                variant='ghost'
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setTsConfigString(temporaryTsConfig)
                  setShowSettings(false)
                }}
                variant='primary'
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Victor+Mono:ital,wght@0,100..700;1,100..700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea { -webkit-text-fill-color: transparent !important; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5); }
        ::selection { background: var(--color-surface2); opacity: 0.5; }
        ::-moz-selection { background: var(--color-surface2); opacity: 0.5; }
      `}</style>
    </div>
  )
}
