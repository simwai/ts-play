import { useState, useEffect, useRef, useCallback } from 'react'
import { type ThemeMode } from './lib/theme'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { Problems } from './components/Problems'
import { OverrideModal } from './components/Modal'
import { PackageManager } from './components/PackageManager'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { formatAllFiles } from './lib/formatter'
import { workerClient } from './lib/workerClient'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useResizePanel } from './hooks/useResizePanel'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { shareSnippet, loadSharedSnippet } from './lib/api'
import { decodeSharePayload } from './lib/shareCodec'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useCompilerManager } from './hooks/useCompilerManager'
import { usePackageManager } from './hooks/usePackageManager'
import { TABS, type TabType, DEFAULT_TSCONFIG } from './lib/constants'
import { playgroundStore } from './lib/state-manager'
import { ToastContainer } from './components/ui/Toast'
import { TypeInfoBar } from './components/ui/TypeInfoBar'
import type { TSDiagnostic, ToastMessage, TypeInfo } from './lib/types'
import { getWebContainer } from './lib/webcontainer'
import * as monaco from 'monaco-editor'
import * as TS from 'typescript'

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

export function App() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const unsubscribe = playgroundStore.subscribe((state) => {
      setToasts(state.toasts)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const [isDarkMode, setIsDarkMode] = useLocalStorage('tsplay_is_dark', true)
  const [preferredDarkTheme, setPreferredDarkTheme] =
    useLocalStorage<ThemeMode>('tsplay_dark_theme', 'mocha')
  const [preferredLightTheme, setPreferredLightTheme] =
    useLocalStorage<ThemeMode>('tsplay_light_theme', 'latte')

  const themeMode = isDarkMode ? preferredDarkTheme : preferredLightTheme

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

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
  const [trueColorEnabled, setTrueColorEnabled] = useLocalStorage(
    'tsplay_truecolor',
    true
  )
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_linewrap', true)
  const [showNodeWarnings, setShowNodeWarnings] = useLocalStorage(
    'tsplay_node_warnings',
    true
  )

  const [activeTab, setActiveTab] = useState<TabType>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<
    'console' | 'problems' | 'packages'
  >('console')

  const tsEditorRef = useRef<CodeEditorRef>(null)
  const jsEditorRef = useRef<CodeEditorRef>(null)
  const dtsEditorRef = useRef<CodeEditorRef>(null)

  useEffect(() => {
    workerClient.updateConfig(tsConfigString).catch(console.error)
  }, [tsConfigString])

  useEffect(() => {
    workerClient.updateFile('/main.ts', tsCode).catch(console.error)
  }, [tsCode])

  const [jsDirty, setJsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [packageManagerOpen, setPackageManagerOpen] = useState(false)
  const { keyboardOpen, isMobileLike } = useVirtualKeyboard()
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

  const [typeInfo, setTypeInfo] = useState<TypeInfo | null>(null)
  const [cursorPos, setCursorPos] = useState<{
    line: number
    col: number
  } | null>(null)

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager()

  const { compilerStatus, isRunning, runCode, stopCode } = useCompilerManager(
    tsCode,
    addMessage
  )

  const {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
  } = usePackageManager(tsCode, addMessage, showNodeWarnings)

  const [monacoDiagnostics, setMonacoDiagnostics] = useState<TSDiagnostic[]>([])

  // Sync Monaco compiler options directly from tsConfigString
  useEffect(() => {
    try {
      const parsed = TS.parseConfigFileTextToJson(
        'tsconfig.json',
        tsConfigString
      )
      if (parsed.error) return
      const config = TS.parseJsonConfigFileContent(
        parsed.config,
        {
          useCaseSensitiveFileNames: true,
          readDirectory: () => [],
          fileExists: () => true,
          readFile: () => tsConfigString,
        },
        '/'
      )
      // Compiler option enums differ between the bundled TS and Monaco;
      // bridge the two typed worlds instead of escaping to `any`.
      monaco.typescript.typescriptDefaults.setCompilerOptions(
        config.options as unknown as Parameters<
          typeof monaco.typescript.typescriptDefaults.setCompilerOptions
        >[0]
      )
    } catch {
      // Ignore parse errors
    }
  }, [tsConfigString])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = /^(INPUT|TEXTAREA)$/.test(
        (e.target as HTMLElement)?.tagName || ''
      )

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

  useEffect(() => {
    getWebContainer()
      .then(async (instance) => {
        try {
          await instance.fs.readFile('package.json', 'utf8')
        } catch {
          await instance.fs.writeFile(
            'package.json',
            JSON.stringify(
              { name: 'playground-project', dependencies: {} },
              null,
              2
            )
          )
        }
      })
      .catch((error) => {
        // Boot can be cancelled during StrictMode double-mount or HMR teardown.
        console.warn('WebContainer boot interrupted:', error)
      })
  }, [])

  // Restore a shared snippet from the URL: embedded (#code=) or server (?share=)
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
            if (typeof data.tsCode === 'string') setTsCode(data.tsCode)
            if (typeof data.jsCode === 'string') setJsCode(data.jsCode)
            addMessage('info', [
              `✓ Loaded shared snippet (${data.remainingDays} days remaining)`,
            ])
            const url = new URL(globalThis.location.href)
            url.searchParams.delete('share')
            globalThis.history.replaceState({}, '', url.toString())
            return
          }
          addMessage('error', [
            `Failed to load shared snippet: ${
              typeof data.error === 'string' ? data.error : 'Unknown error'
            }`,
          ])
        })
        .catch((error) => {
          addMessage('error', [
            `Failed to load shared snippet: ${error.message}`,
          ])
        })
    }
  }, [addMessage, setTsCode, setJsCode])

  const handleCopyAll = useCallback(async () => {
    let content = ''
    if (activeTab === 'ts') content = tsCode
    else if (activeTab === 'js') content = jsCode
    else if (activeTab === 'dts') content = dtsCode

    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = content
      document.body.append(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    playgroundStore.addToast('info', 'Copied to clipboard')
    setTimeout(() => setCopied(false), 1500)
  }, [activeTab, tsCode, jsCode, dtsCode])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('')
    else if (activeTab === 'js') setJsCode('')
    else setDtsCode('')
    playgroundStore.addToast('info', 'Cleared current editor')
  }, [activeTab, setTsCode, setJsCode, setDtsCode])

  const handleFormat = useCallback(async () => {
    setFormatting(true)
    playgroundStore.enqueue('Format', async () => {
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
          playgroundStore.addToast(
            'error',
            `Format issues: ${errors.join(', ')}`
          )
        } else {
          setFormatSuccess(true)
          playgroundStore.addToast(
            'success',
            'All files formatted with Prettier'
          )
          setTimeout(() => setFormatSuccess(false), 1500)
        }
      } catch (error) {
        playgroundStore.addToast(
          'error',
          `Format failed: ${(error as Error).message}`
        )
      } finally {
        setFormatting(false)
      }
    })
  }, [tsCode, jsCode, dtsCode, setTsCode, setJsCode, setDtsCode])

  const handleJsChange = useCallback(
    (v: string) => {
      setJsCode(v)
      setJsDirty(true)
    },
    [setJsCode]
  )

  const doRun = useCallback(
    async (skipDirtyCheck = false) => {
      if (!skipDirtyCheck && jsDirty) {
        setShowModal(true)
        return
      }
      setShowModal(false)
      clearMessages()
      playgroundStore.enqueue('Run', async () => {
        runCode(
          installQueue.current,
          (js, dts) => {
            setJsCode(js)
            setDtsCode(dts)
            setJsDirty(false)
            playgroundStore.addToast('success', 'Compilation successful')
          },
          (error) => {
            playgroundStore.addToast(
              'error',
              `Compilation failed: ${error.message}`
            )
          }
        )
      })
    },
    [jsDirty, runCode, clearMessages, setJsCode, setDtsCode, installQueue]
  )

  const handleShare = useCallback(async () => {
    setSharing(true)
    playgroundStore.enqueue('Share', async () => {
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
          playgroundStore.addToast(
            'success',
            `Share link copied! Expires in ${result.ttlDays} days`
          )
        } else {
          const url = new URL(globalThis.location.href)
          url.searchParams.delete('share')
          url.searchParams.delete('code')
          url.hash = `code=${result.token}`
          await navigator.clipboard.writeText(url.toString())
          setShareSuccess(true)
          playgroundStore.addToast(
            'info',
            'Copied embedded compressed link (PHP share unavailable)'
          )
        }
        setTimeout(() => setShareSuccess(false), 2000)
      } catch (error) {
        playgroundStore.addToast(
          'error',
          `Failed to share: ${(error as Error).message}`
        )
      } finally {
        setSharing(false)
      }
    })
  }, [tsCode, jsCode, installedPackages])

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

  const onTsCursorChange = useCallback(
    (pos: number) => {
      tsCursorPos.current = pos
      checkImports()
    },
    [checkImports]
  )

  const handleJumpToProblem = useCallback((line: number, col: number) => {
    setActiveTab('ts')
    setTimeout(() => {
      tsEditorRef.current?.jumpTo(line, col)
    }, 100)
  }, [])

  const headerCompilerStatus: 'loading' | 'ready' | 'error' =
    compilerStatus === 'loading' ||
    compilerStatus === 'error' ||
    compilerStatus === 'ready'
      ? compilerStatus
      : 'ready'

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      ref={swipeRef}
      className='flex flex-col h-dvh bg-base text-text font-sans overflow-hidden'
    >
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        handleCopyAll={handleCopyAll}
        copied={copied}
        handleDeleteAll={handleDeleteAll}
        handleFormat={handleFormat}
        formatting={formatting}
        formatSuccess={formatSuccess}
        doRun={doRun}
        isRunning={isRunning}
        compilerStatus={headerCompilerStatus}
        handleShare={handleShare}
        sharing={sharing}
        shareSuccess={shareSuccess}
        stopCode={stopCode}
      />

      <StatusBar
        compilerStatus={compilerStatus}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        onOpenSettings={() => setShowSettings(true)}
        compactForKeyboard={compactForKeyboard}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={status}
      />

      <div
        data-testid='swipe-container'
        className='flex-1 overflow-hidden relative min-h-0'
      >
        <div
          className='flex w-[300%] h-full transition-[left] duration-300 ease-in-out relative'
          style={{
            left:
              activeTab === 'ts' ? '0' : activeTab === 'js' ? '-100%' : '-200%',
          }}
        >
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              path='file:///main.ts'
              ref={tsEditorRef}
              value={tsCode}
              onChange={setTsCode}
              onCursorChange={onTsCursorChange}
              onCursorPosChange={setCursorPos}
              onTypeInfoChange={setTypeInfo}
              onDiagnosticsChange={setMonacoDiagnostics}
              language='typescript'
              extraLibs={packageTypings}
              isMobileLike={isMobileLike}
              lineWrap={lineWrap}
              themeMode={themeMode}
            />
          </div>
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              path='file:///main.js'
              ref={jsEditorRef}
              value={jsCode}
              onChange={handleJsChange}
              onCursorPosChange={setCursorPos}
              language='javascript'
              isMobileLike={isMobileLike}
              lineWrap={lineWrap}
              themeMode={themeMode}
            />
          </div>
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              path='file:///main.d.ts'
              ref={dtsEditorRef}
              value={dtsCode}
              onChange={setDtsCode}
              onCursorPosChange={setCursorPos}
              language='typescript'
              readOnly={true}
              isMobileLike={isMobileLike}
              lineWrap={lineWrap}
              themeMode={themeMode}
            />
          </div>
        </div>
      </div>

      <TypeInfoBar
        typeInfo={typeInfo}
        cursorPos={cursorPos}
        language={activeTab === 'js' ? 'javascript' : 'typescript'}
      />

      {!compactForKeyboard && (consoleOpen || packageManagerOpen) && (
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className={`h-2 border-b border-surface0 cursor-ns-resize flex items-center justify-center shrink-0 transition-colors duration-160 relative ${isResizing ? 'bg-peach' : 'bg-surface0'}`}
          title='Drag to resize'
        >
          <div className='w-10 h-1 bg-overlay0 rounded-sm opacity-50' />
        </div>
      )}

      {!compactForKeyboard && (
        <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
          <Console
            messages={messages}
            onClear={clearMessages}
            isOpen={consoleOpen}
            onToggle={() => setPackageManagerOpen(false)}
            contentHeight={panelHeight}
            trueColorEnabled={trueColorEnabled}
            showNodeWarnings={showNodeWarnings}
            activeTab={activeBottomTab}
            onTabChange={setActiveBottomTab}
            problemCount={monacoDiagnostics.length}
          />

          <Problems
            diagnostics={monacoDiagnostics}
            isOpen={consoleOpen && activeBottomTab === 'problems'}
            contentHeight={panelHeight}
            onJumpToProblem={handleJumpToProblem}
          />

          <PackageManager
            packages={installedPackages}
            isOpen={consoleOpen && activeBottomTab === 'packages'} // ← added
            contentHeight={panelHeight}
          />
        </div>
      )}

      {showModal && (
        <OverrideModal
          onConfirm={async () => doRun(true)}
          onCancel={() => setShowModal(false)}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        tsConfigString={tsConfigString}
        onSave={setTsConfigString}
        trueColorEnabled={trueColorEnabled}
        setTrueColorEnabled={setTrueColorEnabled}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        showNodeWarnings={showNodeWarnings}
        setShowNodeWarnings={setShowNodeWarnings}
        isDarkMode={isDarkMode}
        preferredDarkTheme={preferredDarkTheme}
        setPreferredDarkTheme={setPreferredDarkTheme}
        preferredLightTheme={preferredLightTheme}
        setPreferredLightTheme={setPreferredLightTheme}
      />

      <ToastContainer
        toasts={toasts}
        onClose={(id) => playgroundStore.removeToast(id)}
      />
    </div>
  )
}
