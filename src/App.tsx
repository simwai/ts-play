import { useState, useEffect, useRef, useCallback } from 'react'
import { type ThemeMode } from './lib/theme'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { OverrideModal } from './components/Modal'
import { PackageManager } from './components/PackageManager'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { formatAllFiles } from './lib/formatter'
import { workerClient } from './lib/workerClient'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useResizePanel } from './hooks/useResizePanel'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { shareSnippet } from './lib/api'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useCompilerManager } from './hooks/useCompilerManager'
import { usePackageManager } from './hooks/usePackageManager'
import { TABS, type TabType, DEFAULT_TSCONFIG } from './lib/constants'
import { playgroundStore } from './lib/state-manager'
import { ToastContainer } from './components/ui/Toast'
import type { ToastMessage, CompilerStatus } from './lib/types'

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
  const [themeMode, setThemeMode] = useState<ThemeMode>('mocha')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Sync toasts from store
  useEffect(() => {
    const unsubscribe = playgroundStore.subscribe((state) => {
      setToasts(state.toasts)
    })
    return () => { unsubscribe() }
  }, [])

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
  const [trueColorEnabled, setTrueColorEnabled] = useLocalStorage(
    'tsplay_truecolor',
    true
  )
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_linewrap', true)

  const [activeTab, setActiveTab] = useState<TabType>('ts')
  const [jsDirty, setJsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formatSuccess, setFormatSuccess] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [packageManagerOpen, setPackageManagerOpen] = useState(false)

  const tsEditorRef = useRef<CodeEditorRef>(null)
  const jsEditorRef = useRef<CodeEditorRef>(null)
  const dtsEditorRef = useRef<CodeEditorRef>(null)

  const { messages, addMessage, clearMessages } =
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
  } = usePackageManager(tsCode, addMessage)

  const isMobileLike = window.innerWidth < 768
  const { panelHeight, handleResizeStart, isResizing } = useResizePanel(
    20,
    10,
    isMobileLike ? 60 : 80
  )

  const {
    swipeRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    compactForKeyboard,
  } = useSwipeTabs(activeTab, setActiveTab, TABS as unknown as readonly TabType[], false)

  const handleCopyAll = useCallback(() => {
    const code = activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true)
        playgroundStore.addToast('info', 'Copied to clipboard')
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
        playgroundStore.addToast('info', 'Copied to clipboard')
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
          setTimeout(() => {
            setFormatSuccess(false)
          }, 1500)
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

        setTimeout(() => {
          setShareSuccess(false)
        }, 2000)
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

  const handleSetThemeMode = useCallback((mode: ThemeMode | ((m: ThemeMode) => ThemeMode)) => {
    if (typeof mode === 'function') {
      setThemeMode(prev => mode(prev))
    } else {
      setThemeMode(mode)
    }
  }, [])

  const headerCompilerStatus: 'loading' | 'ready' | 'error' =
    compilerStatus === 'loading' || compilerStatus === 'error' || compilerStatus === 'ready'
      ? compilerStatus
      : 'ready'

  return (
    <div className='flex flex-col h-[100dvh] bg-base text-text font-sans overflow-hidden'>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        themeMode={themeMode}
        setThemeMode={handleSetThemeMode}
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
        onOpenSettings={() => {
          setShowSettings(true)
        }}
        compactForKeyboard={compactForKeyboard}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={status}
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
              onCursorChange={onTsCursorChange}
              language='typescript'
              extraLibs={packageTypings}
              isMobileLike={isMobileLike}
            />
          </div>
          {/* JS Editor */}
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              ref={jsEditorRef}
              value={jsCode}
              onChange={handleJsChange}
              language='javascript'
              isMobileLike={isMobileLike}
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
              isMobileLike={isMobileLike}
            />
          </div>
        </div>
      </div>

      {/* ── Resize Divider ── */}
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

      {/* ── Console & Package Manager Section ── */}
      {!compactForKeyboard && (
        <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
          {/* ── Console ── */}
          <Console
            messages={messages}
            onClear={clearMessages}
            isOpen={consoleOpen}
            onToggle={() => setConsoleOpen(!consoleOpen)}
            contentHeight={panelHeight}
            trueColorEnabled={trueColorEnabled}
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
        trueColorEnabled={trueColorEnabled}
        setTrueColorEnabled={setTrueColorEnabled}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={status}
      />

      <ToastContainer
        toasts={toasts}
        onClose={(id) => playgroundStore.removeToast(id)}
      />
    </div>
  )
}
