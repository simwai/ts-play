import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { SettingsModal } from './components/SettingsModal'
import { Problems } from './components/Problems'
import { PackageManager } from './components/PackageManager'
import { TypeInfoBar } from './components/TypeInfoBar'
import {
  tsCodeAtom, jsCodeAtom, dtsCodeAtom, tsConfigAtom,
  isDarkModeAtom, preferredDarkThemeAtom, preferredLightThemeAtom,
  trueColorEnabledAtom, lineWrapAtom, showNodeWarningsAtom,
  compilerStatusAtom, packageManagerStatusAtom, isRunningAtom,
  toastsAtom, removeToastAtom, addToastAtom, jsDirtyAtom
} from './lib/store'
import { useCompilerManager } from './hooks/useCompilerManager'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useTypeInfo } from './hooks/useTypeInfo'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { usePackageManager } from './hooks/usePackageManager'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useTSDiagnostics } from './hooks/useTSDiagnostics'
import { useResizePanel } from './hooks/useResizePanel'
import { ToastContainer } from './components/ui/Toast'
import { workerClient } from './lib/workerClient'
import { TABS } from './lib/constants'
import type { ThemeMode } from './lib/theme'

type Tab = (typeof TABS)[number]

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<
    'console' | 'problems' | 'packages'
  >('console')

  const [isDarkMode, setIsDarkMode] = useAtom(isDarkModeAtom)
  const preferredDarkTheme = useAtomValue(preferredDarkThemeAtom)
  const preferredLightTheme = useAtomValue(preferredLightThemeAtom)
  const setPreferredDarkTheme = useSetAtom(preferredDarkThemeAtom)
  const setPreferredLightTheme = useSetAtom(preferredLightThemeAtom)

  const themeMode = isDarkMode ? preferredDarkTheme : preferredLightTheme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  const [tsCode, setTsCode] = useAtom(tsCodeAtom)
  const [jsCode, setJsCode] = useAtom(jsCodeAtom)
  const [dtsCode, setDtsCode] = useAtom(dtsCodeAtom)
  const [tsConfigString, setTsConfigString] = useAtom(tsConfigAtom)

  const [trueColorEnabled, setTrueColorEnabled] = useAtom(trueColorEnabledAtom)
  const [lineWrap, setLineWrap] = useAtom(lineWrapAtom)
  const [showNodeWarnings, setShowNodeWarnings] = useAtom(showNodeWarningsAtom)

  const [jsDirty, setJsDirty] = useAtom(jsDirtyAtom)
  const [isRunning, setIsRunning] = useAtom(isRunningAtom)
  const [compilerStatus, setCompilerStatus] = useAtom(compilerStatusAtom)
  const [pmStatus, setPmStatus] = useAtom(packageManagerStatusAtom)
  const [toasts, setToasts] = useAtom(toastsAtom)
  const removeToast = useSetAtom(removeToastAtom)
  const addToast = useSetAtom(addToastAtom)

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } = useConsoleManager()

  const { runCode, stopCode } = useCompilerManager(
    tsCode,
    addMessage
  )

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const tsCursorPos = useRef(0)

  const {
    installedPackages,
    packageTypings,
    installQueue,
  } = usePackageManager(tsCode, addMessage, showNodeWarnings)

  const diagnostics = useTSDiagnostics(tsCode, true, packageTypings)

  const { typeInfo, handleTypeInfoChange } = useTypeInfo()

  const { keyboardOpen, isMobileLike } = useVirtualKeyboard()
  const { panelHeight, startResizing } = useResizePanel(300)

  const extraLibs = useMemo(() => {
    const libs: Record<string, string> = {}
    for (const [path, content] of Object.entries(packageTypings)) {
      libs[path] = content
    }
    return libs
  }, [packageTypings])

  const [copied, setCopied] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const tsEditorRef = useRef<CodeEditorRef>(null)

  useEffect(() => {
    workerClient.updateConfig(tsConfigString).then(res => res.match(() => {}, console.error))
  }, [tsConfigString])

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
    [jsDirty, runCode, installQueue, setJsCode, setDtsCode, addMessage, setJsDirty]
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
      addToast({ type: 'success', message: 'Copied to clipboard' })
    } catch {
      addToast({ type: 'error', message: 'Failed to copy to clipboard' })
    }
  }, [activeTab, tsCode, jsCode, dtsCode, addToast])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') {
      setTsCode('')
      setJsCode('')
      setDtsCode('')
    }
    addToast({ type: 'info', message: 'Cleared current editor' })
  }, [activeTab, setTsCode, setJsCode, setDtsCode, addToast])

  return (
    <div
      className="flex flex-col h-screen select-none theme-transition bg-base text-text"
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
              onCursorChange={(offset) => {
                tsCursorPos.current = offset
              }}
              onCursorPosChange={setCursorPos}
              language="typescript"
              theme={themeMode}
              onTypeInfoChange={handleTypeInfoChange}
              extraLibs={extraLibs}
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

        <TypeInfoBar
          typeInfo={typeInfo}
          line={cursorPos.line}
          column={cursorPos.col}
          visible={!compactForKeyboard}
        />
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
        onClose={(id) => removeToast(id)}
      />
    </div>
  )
}
