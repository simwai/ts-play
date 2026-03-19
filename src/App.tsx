import { useState, useEffect, useRef, useCallback } from 'react'
import { type ThemeMode } from './lib/theme'
import { CodeEditor, type CodeEditorHandle } from './components/CodeEditor'
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
import { TABS, type TabType, DEFAULT_TSCONFIG } from './lib/constants'

const DEFAULT_TS = `// TypeScript Playground
// Now powered by Monaco Editor! ✨

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

// Try using a library (ATA will fetch it automatically)
import { map } from 'lodash-es';
console.log("Mapped:", map([1, 2, 3], x => x * 2));
`

export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('mocha')

  useEffect(() => {
    if (themeMode === 'mocha') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [themeMode])

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
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_linewrap', false)

  const [activeTab, setActiveTab] = useState<TabType>('ts')
  const tsEditorRef = useRef<CodeEditorHandle>(null)
  const jsEditorRef = useRef<CodeEditorHandle>(null)
  const dtsEditorRef = useRef<CodeEditorHandle>(null)

  useEffect(() => {
    workerClient.updateConfig(tsConfigString).catch(console.error)
  }, [tsConfigString])

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
  } = usePackageManager(tsCode, addMessage)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey) {
        e.preventDefault()
        setActiveTab((prev) => {
          const idx = TABS.indexOf(prev)
          return e.key === 'ArrowLeft'
            ? TABS[(idx - 1 + TABS.length) % TABS.length]
            : TABS[(idx + 1) % TABS.length]
        })
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  const handleCopyAll = useCallback(() => {
    const code =
      activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [activeTab, tsCode, jsCode, dtsCode])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('')
    else if (activeTab === 'js') {
      setJsCode('')
      setJsDirty(false)
    } else setDtsCode('')
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
      if (errors.length > 0)
        addMessage('warn', [`Format had issues: ${errors.join(', ')}`])
      else {
        setFormatSuccess(true)
        addMessage('info', ['✓ All files formatted with Prettier'])
        setTimeout(() => setFormatSuccess(false), 1500)
      }
    } catch (error) {
      addMessage('error', [`Format failed: ${(error as Error).message}`])
    } finally {
      setFormatting(false)
    }
  }, [tsCode, jsCode, dtsCode, addMessage, setTsCode, setJsCode, setDtsCode])

  const handleJsChange = useCallback(
    (v: string) => {
      setJsCode(v)
      setJsDirty(true)
    },
    [setJsCode]
  )
  const onTsCursorChange = useCallback(
    (pos: number) => {
      tsCursorPos.current = pos
      checkImports()
    },
    [checkImports]
  )

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
    [
      jsDirty,
      runCode,
      clearMessages,
      addMessage,
      setJsCode,
      setDtsCode,
      installQueue,
    ]
  )

  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      const result = await shareSnippet({
        tsCode,
        jsCode,
        packages: installedPackages,
      })
      const url = new URL(globalThis.location.href)
      if (result.type === 'server') {
        url.searchParams.set('share', result.id)
        url.searchParams.delete('code')
        url.hash = ''
        await navigator.clipboard.writeText(url.toString())
        addMessage('info', [
          `✓ Share link copied! Expires in ${result.ttlDays} days`,
        ])
      } else {
        url.searchParams.delete('share')
        url.searchParams.delete('code')
        url.hash = `code=${result.token}`
        await navigator.clipboard.writeText(url.toString())
        addMessage('warn', [
          'PHP share unavailable. Copied embedded link instead.',
        ])
      }
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2000)
    } catch (error) {
      addMessage('error', [`Failed to share: ${(error as Error).message}`])
    } finally {
      setSharing(false)
    }
  }, [tsCode, jsCode, installedPackages, addMessage])

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
        stopCode={stopCode}
      />
      <StatusBar
        compilerStatus={compilerStatus}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={() =>
          (activeTab === 'ts'
            ? tsEditorRef
            : activeTab === 'js'
              ? jsEditorRef
              : dtsEditorRef
          ).current?.undo()
        }
        handleRedo={() =>
          (activeTab === 'ts'
            ? tsEditorRef
            : activeTab === 'js'
              ? jsEditorRef
              : dtsEditorRef
          ).current?.redo()
        }
        onOpenSettings={() => setShowSettings(true)}
        compactForKeyboard={compactForKeyboard}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={status}
      />

      <div
        ref={swipeRef}
        className='flex-1 overflow-hidden relative min-h-0'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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
          <div className='w-[33.333%] h-full shrink-0'>
            <CodeEditor
              ref={jsEditorRef}
              value={jsCode}
              onChange={handleJsChange}
              language='javascript'
              isMobileLike={isMobileLike}
            />
          </div>
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

      {!compactForKeyboard && (
        <div className='overflow-hidden flex flex-col shrink-0 bg-base'>
          <Console
            messages={messages}
            onClear={clearMessages}
            isOpen={consoleOpen}
            onToggle={toggleConsole}
            contentHeight={panelHeight}
            trueColorEnabled={trueColorEnabled}
          />
          <PackageManager
            packages={installedPackages}
            isOpen={packageManagerOpen}
            onToggle={() => setPackageManagerOpen((o) => !o)}
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
        packageManagerStatus={status}
      />
    </div>
  )
}
