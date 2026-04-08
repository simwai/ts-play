import { useState, useCallback, useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { Problems } from './components/Problems'
import { PackageManager } from './components/PackageManager'
import { SettingsModal } from './components/SettingsModal'
import { ToastContainer } from './components/ui/Toast'
import { useCompilerManager } from './hooks/useCompilerManager'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useTypeInfo } from './hooks/useTypeInfo'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { usePackageManager } from './hooks/usePackageManager'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useTSDiagnostics } from './hooks/useTSDiagnostics'
import { useResizePanel } from './hooks/useResizePanel'
import { playgroundStore } from './lib/state-manager'
import { workerClient } from './lib/workerClient'
import { DEFAULT_TS, DEFAULT_TSCONFIG } from './lib/constants'
import type { TabType, ThemeMode } from './lib/types'

const TABS = ['ts', 'js', 'dts'] as const
type Tab = (typeof TABS)[number]

export function App() {
  const [tsCode, setTsCode] = useState(DEFAULT_TS)
  const [jsCode, setJsCode] = useState('')
  const [dtsCode, setDtsCode] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'problems' | 'packages'>('console')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [preferredDarkTheme, setPreferredDarkTheme] = useState('github-dark')
  const [preferredLightTheme, setPreferredLightTheme] = useState('github-light')
  const [lineWrap, setLineWrap] = useState(true)
  const [trueColorEnabled, setTrueColorEnabled] = useState(true)
  const [showNodeWarnings, _setShowNodeWarnings] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tsConfigString, setTsConfigString] = useState(DEFAULT_TSCONFIG)
  const [showSettings, setShowSettings] = useState(false)

  const themeMode: ThemeMode = isDarkMode ? 'dark' : 'light'

  const {
    messages,
    addMessage,
    clearMessages,
  } = useConsoleManager()

  const {
    compilerStatus,
    isRunning,
    runCode,
    stopCode,
  } = useCompilerManager(tsCode, addMessage)

  const {
    installedPackages,
    packageTypings,
    status: pmStatus,
    installQueue,
  } = usePackageManager()

  const tsCursorPos = useRef(0)
  const { typeInfo, handleTypeInfoChange } = useTypeInfo(tsCursorPos)

  const handleCursorPosChange = useCallback((pos: { line: number; col: number }) => {
    // Offset calculation would go here
  }, [])

  const diagnostics = useTSDiagnostics(tsCode, activeTab === 'ts', packageTypings)
  const { keyboardOpen, isMobileLike } = useVirtualKeyboard()

  const [consoleOpen, setConsoleOpen] = useState(true)
  const toggleConsole = useCallback(() => setConsoleOpen((v) => !v), [])

  const { panelHeight, handleResizeStart: startResizing } = useResizePanel(11.25)

  useEffect(() => {
    workerClient.updateConfig(tsConfigString).catch(console.error)
  }, [tsConfigString])

  const [jsDirty, setJsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const compactForKeyboard = keyboardOpen && isMobileLike

  const doRun = useCallback(
    async (force = false) => {
      if (jsDirty && !force) {
        setShowModal(true)
        return
      }
      setShowModal(false)
      setJsDirty(false)
      await runCode(
        installQueue.current,
        (js, dts) => {
          setJsCode(js)
          setDtsCode(dts)
        },
        (err) => {
          addMessage('error', [err.message])
        }
      )
    },
    [jsDirty, runCode, installQueue, addMessage]
  )

  const handleJumpToProblem = useCallback((line: number) => {
    setActiveTab('ts')
    tsEditorRef.current?.jumpTo(line, 1)
  }, [])

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeTabs(
    activeTab,
    (tab) => setActiveTab(tab as Tab),
    TABS,
    false
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'INPUT'

      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        (!isInput || e.altKey)
      ) {
        e.preventDefault()
        setActiveTab((previous: Tab) => {
          const idx = TABS.indexOf(previous)
          if (e.key === 'ArrowLeft') {
            return TABS[(idx - 1 + TABS.length) % TABS.length] as Tab
          }
          return TABS[(idx + 1) % TABS.length] as Tab
        })
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleCopyAll = useCallback(async () => {
    let content = ''
    if (activeTab === 'ts') content = tsCode
    else if (activeTab === 'js') content = jsCode
    else if (activeTab === 'dts') content = dtsCode

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      playgroundStore.addToast('info', 'Copied to clipboard')
    } catch {
      playgroundStore.addToast('error', 'Failed to copy to clipboard')
    }
  }, [activeTab, tsCode, jsCode, dtsCode])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') {
      setTsCode('')
      setJsCode('')
      setDtsCode('')
    }
    playgroundStore.addToast('info', 'Cleared current editor')
  }, [activeTab])

  const [toasts, setToasts] = useState(playgroundStore.getState().toasts)
  useEffect(
    () => playgroundStore.subscribe((state) => setToasts(state.toasts)),
    []
  )

  const tsEditorRef = useRef<CodeEditorRef>(null)

  return (
    <div
      className='flex flex-col h-screen select-none theme-transition'
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRun={doRun}
        stopCode={stopCode}
        isRunning={isRunning}
        compilerStatus={compilerStatus}
        onSettings={() => setShowSettings(true)}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onCopyAll={handleCopyAll}
        onDeleteAll={handleDeleteAll}
        copied={copied}
      />

      <StatusBar
        compilerStatus={compilerStatus}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={() => tsEditorRef.current?.undo()}
        handleRedo={() => tsEditorRef.current?.redo()}
        onOpenSettings={() => setShowSettings(true)}
        compactForKeyboard={compactForKeyboard}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={pmStatus}
      />

      <main className='flex-1 min-h-0 relative flex flex-col'>
        <div className='flex-1 min-h-0 relative'>
          <div
            className='absolute inset-0 transition-opacity duration-200'
            style={{
              opacity: activeTab === 'ts' ? 1 : 0,
              pointerEvents: activeTab === 'ts' ? 'auto' : 'none',
              zIndex: activeTab === 'ts' ? 10 : 0,
            }}
          >
            <CodeEditor
              ref={tsEditorRef}
              path='file:///index.ts'
              value={tsCode}
              onChange={(v) => {
                setTsCode(v || '')
                setJsDirty(true)
              }}
              language='typescript'
              theme={themeMode}
              onTypeInfoChange={handleTypeInfoChange}
              onCursorPosChange={handleCursorPosChange}
              extraLibs={packageTypings}
              diagnostics={diagnostics}
              lineWrap={lineWrap}
            />
          </div>

          <div
            className='absolute inset-0 transition-opacity duration-200'
            style={{
              opacity: activeTab === 'js' ? 1 : 0,
              pointerEvents: activeTab === 'js' ? 'auto' : 'none',
              zIndex: activeTab === 'js' ? 10 : 0,
            }}
          >
            <CodeEditor
              path='file:///index.js'
              value={jsCode}
              language='javascript'
              theme={themeMode}
              readOnly
              lineWrap={lineWrap}
            />
          </div>

          <div
            className='absolute inset-0 transition-opacity duration-200'
            style={{
              opacity: activeTab === 'dts' ? 1 : 0,
              pointerEvents: activeTab === 'dts' ? 'auto' : 'none',
              zIndex: activeTab === 'dts' ? 10 : 0,
            }}
          >
            <CodeEditor
              path='file:///index.d.ts'
              value={dtsCode}
              language='typescript'
              theme={themeMode}
              readOnly
              lineWrap={lineWrap}
            />
          </div>
        </div>
      </main>

      {!compactForKeyboard && (
        <div
          className='flex flex-col bg-crust relative'
          style={{ height: consoleOpen ? panelHeight + 'rem' : 'auto' }}
        >
          <div
            className='h-1 cursor-row-resize hover:bg-lavender/30 transition-colors absolute top-0 left-0 right-0 z-50'
            onMouseDown={startResizing}
          />

          <Console
            messages={messages}
            isOpen={consoleOpen && activeBottomTab === 'console'}
            onToggle={toggleConsole}
            onClear={clearMessages}
            contentHeight={panelHeight}
            showNodeWarnings={false}
            activeTab={activeBottomTab}
            onTabChange={setActiveBottomTab}
            problemCount={diagnostics.length}
          />

          <Problems
            diagnostics={diagnostics}
            isOpen={consoleOpen && activeBottomTab === 'problems'}
            contentHeight={panelHeight}
            onJumpToProblem={handleJumpToProblem}
          />

          <PackageManager
            packages={installedPackages}
            isOpen={consoleOpen && activeBottomTab === 'packages'}
            onToggle={toggleConsole}
            contentHeight={panelHeight}
          />
        </div>
      )}

      {showModal && (
        <div className='fixed inset-0 bg-crust/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4'>
          <div className='bg-mantle border border-surface0 rounded-lg max-w-md w-full p-6 shadow-2xl'>
            <h3 className='text-lg font-bold text-text mb-2'>
              Unsaved Changes
            </h3>
            <p className='text-subtext0 mb-6'>
              The compiled JavaScript does not match your TypeScript code. Run
              anyway?
            </p>
            <div className='flex justify-end gap-3'>
              <button
                onClick={() => setShowModal(false)}
                className='px-4 py-2 rounded-md hover:bg-surface0 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => doRun(true)}
                className='px-4 py-2 bg-lavender text-crust font-bold rounded-md hover:opacity-90 transition-opacity'
              >
                Run Anyway
              </button>
            </div>
          </div>
        </div>
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
        packageManagerStatus={pmStatus}
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
