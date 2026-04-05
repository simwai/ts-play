import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console, type ConsoleMessage } from './components/Console'
import { SettingsModal } from './components/SettingsModal'
import { Problems } from './components/Problems'
import { PackageManager } from './components/PackageManager'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useCompilerManager } from './hooks/useCompilerManager'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useTypeInfo } from './hooks/useTypeInfo'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { usePackageManager } from './hooks/usePackageManager'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useTSDiagnostics } from './hooks/useTSDiagnostics'
import { useResizePanel } from './hooks/useResizePanel'
import { playgroundStore } from './lib/state-manager'
import { ToastContainer } from './components/ui/Toast'
import { workerClient } from './lib/workerClient'
import { DEFAULT_TS, DEFAULT_TSCONFIG } from './lib/constants'
import type { ThemeMode } from './lib/theme'

const TABS = ['ts', 'js', 'dts'] as const
type Tab = (typeof TABS)[number]

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<
    'console' | 'problems' | 'packages'
  >('console')

  const [isDarkMode, setIsDarkMode] = useLocalStorage('tsplay_is_dark', true)
  const [preferredDarkTheme, setPreferredDarkTheme] =
    useLocalStorage<ThemeMode>('tsplay_dark_theme', 'mocha')
  const [preferredLightTheme, setPreferredLightTheme] =
    useLocalStorage<ThemeMode>('tsplay_light_theme', 'latte')

  const themeMode = isDarkMode ? preferredDarkTheme : preferredLightTheme

  // Toggle dark mode class on HTML element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const [tsCode, setTsCode] = useLocalStorage('tsplay_ts', DEFAULT_TS)
  const [jsCode, setJsCode] = useLocalStorage(
    'tsplay_js',
    '// Press Run to compile TypeScript →'
  )
  const [dtsCode, setDtsCode] = useLocalStorage(
    'tsplay_dts',
    '// Declaration files will appear here'
  )
  const [tsConfigString, setTsConfigString] = useLocalStorage(
    'tsplay_tsconfig',
    DEFAULT_TSCONFIG
  )

  const [trueColorEnabled, setTrueColorEnabled] = useLocalStorage(
    'tsplay_true_color',
    true
  )
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_line_wrap', false)
  const [showNodeWarnings, setShowNodeWarnings] = useLocalStorage(
    'tsplay_show_node_warnings',
    false
  )

  const { messages, addMessage, clearMessages } = useConsoleManager()
  const { compilerStatus, isRunning, runCode, stopCode } = useCompilerManager(
    tsCode,
    addMessage
  )
  const {
    installedPackages,
    packageTypings,
    tsCursorPos,
    status: pmStatus,
    installQueue,
  } = usePackageManager(tsCode, addMessage, showNodeWarnings)

  const diagnostics = useTSDiagnostics(tsCode)

  const { typeInfo, handleTypeInfoChange, handleCursorPosChange } =
    useTypeInfo(tsCursorPos)

  const { keyboardOpen, isMobileLike } = useVirtualKeyboard()

  const [consoleOpen, setConsoleOpen] = useState(true)
  const toggleConsole = useCallback(() => setConsoleOpen((v) => !v), [])

  const { panelHeight, startResizing } = useResizePanel(300)

  // Combined extra libs for Monaco
  const extraLibs = useMemo(() => {
    const libs = []
    for (const [path, content] of Object.entries(packageTypings)) {
      libs.push({ content, filePath: path })
    }
    return libs
  }, [packageTypings])

  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Editor Refs for Undo/Redo
  const tsEditorRef = useRef<CodeEditorRef>(null)

  // Send tsconfig to worker whenever it changes
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
      await runCode(installQueue.current, (js, dts) => {
        setJsCode(js)
        setDtsCode(dts)
      }, (err) => {
        addMessage('error', [err.message])
      })
    },
    [jsDirty, runCode, installQueue, setJsCode, setDtsCode, addMessage]
  )

  const handleJumpToProblem = useCallback((line: number) => {
    setActiveTab('ts')
    tsEditorRef.current?.revealLine(line)
    tsEditorRef.current?.focus()
  }, [])

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeTabs(
    activeTab,
    (tab) => setActiveTab(tab as Tab),
    ['ts', 'js', 'dts']
  )

  // Global Keyboard Shortcuts (Tab Switching)
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

  const handleCopyAll = useCallback(async () => {
    let content = ''
    if (activeTab === 'ts') content = tsCode
    else if (activeTab === 'js') content = jsCode
    else if (activeTab === 'dts') content = dtsCode

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      playgroundStore.addToast('success', 'Copied to clipboard')
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
  }, [activeTab, setTsCode, setJsCode, setDtsCode])

  const [toasts, setToasts] = useState(playgroundStore.getState().toasts)
  useEffect(() => playgroundStore.subscribe((state) => setToasts(state.toasts)), [])

  return (
    <div
      className="flex flex-col h-screen select-none theme-transition"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRun={doRun}
        onStop={stopCode}
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

      <main className="flex-1 min-h-0 relative flex flex-col">
        <div className="flex-1 min-h-0 relative">
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: activeTab === 'ts' ? 1 : 0,
              pointerEvents: activeTab === 'ts' ? 'auto' : 'none',
              zIndex: activeTab === 'ts' ? 10 : 0,
            }}
          >
            <CodeEditor
              ref={tsEditorRef}
              path="file:///index.ts"
              value={tsCode}
              onChange={(v) => {
                setTsCode(v || '')
                setJsDirty(true)
              }}
              language="typescript"
              theme={themeMode}
              onTypeInfoChange={handleTypeInfoChange}
              onCursorPosChange={handleCursorPosChange}
              extraLibs={packageTypings}
              diagnostics={diagnostics}
              lineWrap={lineWrap}
            />
          </div>

          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: activeTab === 'js' ? 1 : 0,
              pointerEvents: activeTab === 'js' ? 'auto' : 'none',
              zIndex: activeTab === 'js' ? 10 : 0,
            }}
          >
            <CodeEditor
              path="file:///index.js"
              value={jsCode}
              language="javascript"
              theme={themeMode}
              readOnly
              lineWrap={lineWrap}
            />
          </div>

          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              opacity: activeTab === 'dts' ? 1 : 0,
              pointerEvents: activeTab === 'dts' ? 'auto' : 'none',
              zIndex: activeTab === 'dts' ? 10 : 0,
            }}
          >
            <CodeEditor
              path="file:///index.d.ts"
              value={dtsCode}
              language="typescript"
              theme={themeMode}
              readOnly
              lineWrap={lineWrap}
            />
          </div>
        </div>

        <div
          className="h-6 flex items-center px-3 bg-mantle border-t border-surface0 text-xxs text-subtext1 font-mono overflow-hidden whitespace-nowrap"
          style={{ display: compactForKeyboard ? 'none' : 'flex' }}
        >
          <div className="flex-1 truncate">
            {typeInfo || 'Ready'}
          </div>
          <div className="ml-4 opacity-70">
            Ln {tsCursorPos.current > 0 ? (tsCode.slice(0, tsCursorPos.current).split('\n').length) : 1}, Col {tsCursorPos.current - tsCode.lastIndexOf('\n', tsCursorPos.current - 1)}
          </div>
        </div>
      </main>

      {!compactForKeyboard && (
        <div
          className="flex flex-col bg-crust relative"
          style={{ height: consoleOpen ? panelHeight : 'auto' }}
        >
          <div
            className="h-1 cursor-row-resize hover:bg-lavender/30 transition-colors absolute top-0 left-0 right-0 z-50"
            onMouseDown={startResizing}
          />

          <Console
            messages={messages}
            isOpen={consoleOpen && activeBottomTab === 'console'}
            onToggle={toggleConsole}
            onClear={clearMessages}
            contentHeight={panelHeight}
            showNodeWarnings={showNodeWarnings}
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
        <div className="fixed inset-0 bg-crust/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 rounded-lg max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-text mb-2">Unsaved Changes</h3>
            <p className="text-subtext0 mb-6">
              The compiled JavaScript does not match your TypeScript code. Run anyway?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-md hover:bg-surface0 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => doRun(true)}
                className="px-4 py-2 bg-lavender text-crust font-bold rounded-md hover:opacity-90 transition-opacity"
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
