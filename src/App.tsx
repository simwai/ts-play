import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import {
  tsCodeAtom,
  jsCodeAtom,
  dtsCodeAtom,
  tsConfigAtom,
  isDarkModeAtom,
  preferredDarkThemeAtom,
  preferredLightThemeAtom,
  trueColorEnabledAtom,
  lineWrapAtom,
  showNodeWarningsAtom,
  compilerStatusAtom,
  packageManagerStatusAtom,
  isRunningAtom,
  toastsAtom,
  jsDirtyAtom,
  addToastAtom,
  removeToastAtom,
  enqueueTaskAtom,
} from './lib/store'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { Problems } from './components/Problems'
import { PackageManager } from './components/PackageManager'
import { SettingsModal } from './components/SettingsModal'
import { TypeInfoBar } from './components/ui/TypeInfoBar'
import { ToastContainer } from './components/ui/Toast'
import { useCompilerManager } from './hooks/useCompilerManager'
import { useConsoleManager } from './hooks/useConsoleManager'
import { usePackageManager } from './hooks/usePackageManager'
import { useTSDiagnostics } from './hooks/useTSDiagnostics'
import { useTypeInfo } from './hooks/useTypeInfo'
import { useResizePanel } from './hooks/useResizePanel'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { TABS, type TabType } from './lib/constants'
import { workerClient } from './lib/workerClient'
import { formatAllFiles } from './lib/formatter'
import { encodeSharePayload } from './lib/shareCodec'

type Tab = TabType

export function App() {
  const [tsCode, setTsCode] = useAtom(tsCodeAtom)
  const [jsCode, setJsCode] = useAtom(jsCodeAtom)
  const [dtsCode, setDtsCode] = useAtom(dtsCodeAtom)
  const [tsConfigString, setTsConfigString] = useAtom(tsConfigAtom)
  const [isDarkMode, setIsDarkMode] = useAtom(isDarkModeAtom)
  const [preferredDarkTheme, setPreferredDarkTheme] = useAtom(preferredDarkThemeAtom)
  const [preferredLightTheme, setPreferredLightTheme] = useAtom(preferredLightThemeAtom)
  const [trueColorEnabled, setTrueColorEnabled] = useAtom(trueColorEnabledAtom)
  const [lineWrap, setLineWrap] = useAtom(lineWrapAtom)
  const [showNodeWarnings, setShowNodeWarnings] = useAtom(showNodeWarningsAtom)

  const compilerStatusFromStore = useAtomValue(compilerStatusAtom)
  const pmStatus = useAtomValue(packageManagerStatusAtom)
  const isRunningFromStore = useAtomValue(isRunningAtom)
  const toasts = useAtomValue(toastsAtom)
  const [jsDirty, setJsDirty] = useAtom(jsDirtyAtom)

  const addToast = useSetAtom(addToastAtom)
  const removeToast = useSetAtom(removeToastAtom)
  const enqueueTask = useSetAtom(enqueueTaskAtom)

  const themeMode = isDarkMode ? preferredDarkTheme : preferredLightTheme

  const [activeTab, setActiveTab] = useState<Tab>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'problems' | 'packages'>('console')

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } = useConsoleManager()

  const { runCode, stopCode, compilerStatus, isRunning } = useCompilerManager(
    tsCode,
    addMessage
  )

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })

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

      await enqueueTask({
        name: 'Run',
        task: async () => {
          await runCode(installQueue.current, (js, dts) => {
            setJsCode(js)
            setDtsCode(dts)
          }, (err) => {
            addMessage('error', [err.message])
          })
        }
      })
    },
    [jsDirty, runCode, installQueue, setJsCode, setDtsCode, addMessage, setJsDirty, enqueueTask]
  )

  const doFormat = useCallback(async () => {
    await enqueueTask({
      name: 'Format',
      task: async () => {
        const formatted = await formatAllFiles(tsCode, jsCode, dtsCode)
        setTsCode(formatted.ts)
        setJsCode(formatted.js)
        setDtsCode(formatted.dts)
        addToast({ type: 'success', message: 'Code formatted' })
      }
    })
  }, [tsCode, jsCode, dtsCode, setTsCode, setJsCode, setDtsCode, enqueueTask, addToast])

  const doShare = useCallback(async () => {
    await enqueueTask({
      name: 'Share',
      task: async () => {
        const payload = {
          tsCode,
          jsCode,
          packages: installedPackages
        }
        const token = await encodeSharePayload(payload)
        const url = new URL(window.location.href)
        url.searchParams.set('share', token)
        await navigator.clipboard.writeText(url.toString())
        window.history.replaceState(null, '', url)
        addToast({ type: 'success', message: 'Share link copied to clipboard' })
      }
    })
  }, [tsCode, jsCode, installedPackages, enqueueTask, addToast])

  const handleJumpToProblem = useCallback((line: number) => {
    setActiveTab('ts')
    tsEditorRef.current?.revealLine(line)
    tsEditorRef.current?.focus()
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
        onFormat={doFormat}
        onShare={doShare}
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
          cursorPos={cursorPos}
          language={activeTab === 'ts' ? 'typescript' : 'javascript'}
          themeMode={themeMode}
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
