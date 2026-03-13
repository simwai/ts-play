import { useState, useEffect, useRef, useCallback } from 'react'
import { type ThemeMode } from './lib/theme'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { OverrideModal } from './components/Modal'
import { PackageManager } from './components/PackageManager'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { decodeSharePayload } from './lib/shareCodec'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { formatAllFiles } from './lib/formatter'
import { workerClient } from './lib/workerClient'
import { getWebContainer } from './lib/webcontainer'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useResizePanel } from './hooks/useResizePanel'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { shareSnippet, loadSharedSnippet } from './lib/api'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useCompilerManager } from './hooks/useCompilerManager'
import { usePackageManager } from './hooks/usePackageManager'
import { TABS, type TabType } from './lib/constants'

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
  const [tsCode, setTsCode] = useLocalStorage('tsplay_ts', DEFAULT_TS)
  const [jsCode, setJsCode] = useLocalStorage(
    'tsplay_js',
    '// Press Run to compile TypeScript →'
  )
  const [dtsCode, setDtsCode] = useLocalStorage(
    'tsplay_dts',
    '// .d.ts declarations will appear here'
  )
  const [tsConfigString, setTsConfigString] = useLocalStorage(
    'tsplay_tsconfig',
    DEFAULT_TSCONFIG
  )

  const [activeTab, setActiveTab] = useState<TabType>('ts')

  // Editor Refs for Undo/Redo
  const tsEditorRef = useRef<CodeEditorRef>(null)
  const jsEditorRef = useRef<CodeEditorRef>(null)
  const dtsEditorRef = useRef<CodeEditorRef>(null)

  // Send tsconfig to worker whenever it changes
  useEffect(() => {
    workerClient.updateConfig(tsConfigString).catch(console.error)
  }, [tsConfigString])

  const [jsDirty, setJsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [packageManagerOpen, setPackageManagerOpen] = useState(false)
  const { keyboardOpen, keyboardHeight, isMobileLike } = useVirtualKeyboard()
  const compactForKeyboard = keyboardOpen && isMobileLike

  const { panelHeight, isResizing, handleResizeStart } = useResizePanel()
  const { swipeRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeTabs(
    activeTab,
    setActiveTab,
    TABS,
    compactForKeyboard
  )

  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formatSuccess, setFormatSuccess] = useState(false)

  // Custom Hooks
  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager()
  const { compilerStatus, isRunning, runCode } = useCompilerManager(
    tsCode,
    addMessage
  )
  const {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
  } = usePackageManager(tsCode, addMessage)

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
          const idx = TABS.indexOf(previous)
          if (e.key === 'ArrowLeft') {
            return TABS[(idx - 1 + TABS.length) % TABS.length]
          }

          return TABS[(idx + 1) % TABS.length]
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
      loadSharedSnippet(shareId)
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
  }, [addMessage, setTsCode, setJsCode])

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
  }, [activeTab, setTsCode, setJsCode, setDtsCode])

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
  }, [tsCode, jsCode, dtsCode, addMessage, setTsCode, setJsCode, setDtsCode])

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
    [jsDirty, runCode, clearMessages, addMessage, setJsCode, setDtsCode, installQueue]
  )

  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      const result = await shareSnippet({
        tsCode,
        jsCode,
        packages: installedPackages,
      })

      if (result.type === 'server') {
        const url = new URL(globalThis.location.href)
        url.searchParams.set('share', result.id)
        url.searchParams.delete('code')
        url.hash = ''
        await navigator.clipboard.writeText(url.toString())
        setShareSuccess(true)
        addMessage('info', [
          `✓ Share link copied! Expires in ${result.ttlDays} days`,
        ])
      } else {
        const url = new URL(globalThis.location.href)
        url.searchParams.delete('share')
        url.searchParams.delete('code')
        url.hash = `code=${result.token}`
        await navigator.clipboard.writeText(url.toString())
        setShareSuccess(true)
        addMessage('warn', [
          `PHP share unavailable: ${result.error?.message}`,
          'Copied embedded compressed link instead. It is stored in the URL itself and has no 7-day TTL.',
        ])
      }

      setTimeout(() => {
        setShareSuccess(false)
      }, 2000)
    } catch (error) {
      addMessage('error', [`Failed to share: ${(error as Error).message}`])
    } finally {
      setSharing(false)
    }
  }, [tsCode, jsCode, installedPackages, addMessage])

  const handleUndo = useCallback(() => {
    if (activeTab === 'ts') tsEditorRef.current?.undo()
    else if (activeTab === 'js') jsEditorRef.current?.undo()
    else if (activeTab === 'dts') dtsEditorRef.current?.undo()
  }, [activeTab])

  const handleRedo = useCallback(() => {
    if (activeTab === 'ts') tsEditorRef.current?.redo()
    else if (activeTab === 'js') jsEditorRef.current?.redo()
    else if (activeTab === 'dts') dtsEditorRef.current?.redo()
  }, [activeTab])

  return (
    <div className='flex flex-col h-[100dvh] bg-base text-text font-sans overflow-hidden'>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        handleCopyAll={handleCopyAll}
        copied={copied}
        handleDeleteAll={handleDeleteAll}
        handleFormat={handleFormat}
        formatting={formatting}
        formatSuccess={formatSuccess}
        doRun={doRun}
        isRunning={isRunning}
        compilerStatus={compilerStatus}
        handleShare={handleShare}
        sharing={sharing}
        shareSuccess={shareSuccess}
      />

      <StatusBar
        compilerStatus={compilerStatus}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        onOpenSettings={() => {
          setShowSettings(true)
        }}
        compactForKeyboard={compactForKeyboard}
      />

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
              ref={tsEditorRef}
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
              ref={jsEditorRef}
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
              ref={dtsEditorRef}
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
            onToggle={() => {
              setPackageManagerOpen((o) => !o)
            }}
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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false)
        }}
        tsConfigString={tsConfigString}
        onSave={setTsConfigString}
      />
    </div>
  )
}
