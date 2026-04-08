import { useState, useCallback, useEffect, useRef } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { CodeEditor, type CodeEditorRef } from './components/CodeEditor'
import { Console } from './components/Console'
import { Problems } from './components/Problems'
import { PackageManager } from './components/PackageManager'
import { SettingsModal } from './components/SettingsModal'
import { ToastContainer } from './components/ui/Toast'
import { OverrideModal } from './components/OverrideModal'
import { useCompilerManager } from './hooks/useCompilerManager'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useTypeInfo } from './hooks/useTypeInfo'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { usePackageManager } from './hooks/usePackageManager'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { useTSDiagnostics } from './hooks/useTSDiagnostics'
import { useResizePanel } from './hooks/useResizePanel'
import { workerClient } from './lib/workerClient'
import { formatAllFiles } from './lib/formatter'
import { getShareUrl } from './lib/api'
import { type TabType } from './lib/types'
import { cn } from './lib/utils'

import {
  tsCodeAtom,
  jsCodeAtom,
  dtsCodeAtom,
  tsConfigAtom,
  isDarkModeAtom,
  jsDirtyAtom,
  isRunningAtom,
  compilerStatusAtom,
  packageManagerStatusAtom,
  toastsAtom,
  removeToastAtom,
  addToastAtom,
  enqueueTaskAtom,
  showNodeWarningsAtom,
  autoImportsAtom,
  customAutocompleteAtom,
} from './lib/store'

const TABS = ['ts', 'js', 'dts'] as const

export function App() {
  const [tsCode, setTsCode] = useAtom(tsCodeAtom)
  const [jsCode, setJsCode] = useAtom(jsCodeAtom)
  const [dtsCode, setDtsCode] = useAtom(dtsCodeAtom)
  const [tsConfigString] = useAtom(tsConfigAtom)
  const [isDarkMode, setIsDarkMode] = useAtom(isDarkModeAtom)
  const [jsDirty, setJsDirty] = useAtom(jsDirtyAtom)
  const [isRunning] = useAtom(isRunningAtom)
  const [compilerStatus] = useAtom(compilerStatusAtom)
  const [pmStatus] = useAtom(packageManagerStatusAtom)
  const [toasts] = useAtom(toastsAtom)
  const [showNodeWarnings] = useAtom(showNodeWarningsAtom)
  const [autoImports] = useAtom(autoImportsAtom)
  const [customAutocomplete] = useAtom(customAutocompleteAtom)

  const removeToast = useSetAtom(removeToastAtom)
  const enqueueTask = useSetAtom(enqueueTaskAtom)
  const addToast = useSetAtom(addToastAtom)

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager()
  const { runCode, stopCode } = useCompilerManager(tsCode, addMessage)
  const { installedPackages, packageTypings, installQueue } = usePackageManager(
    tsCode,
    addMessage,
    showNodeWarnings
  )

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [activeTab, setActiveTab] = useState<TabType>('ts')
  const [activeBottomTab, setActiveBottomTab] = useState<
    'console' | 'problems' | 'packages'
  >('console')
  const [showSettings, setShowSettings] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formatSuccess, setFormatSuccess] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  const diagnostics = useTSDiagnostics(
    tsCode,
    activeTab === 'ts',
    packageTypings
  )
  const tsCursorPos = useRef(0)
  const { typeInfo, handleTypeInfoChange } = useTypeInfo(tsCursorPos)
  const { keyboardOpen, isMobileLike } = useVirtualKeyboard()
  const { panelHeight, startResizing } = useResizePanel(11.25)
  const tsEditorRef = useRef<CodeEditorRef>(null)

  useEffect(() => {
    workerClient.updateConfig(tsConfigString)
  }, [tsConfigString])

  const doRun = useCallback(
    async (force = false) => {
      if (jsDirty && !force) {
        setShowModal(true)
        return
      }
      setShowModal(false)
      setJsDirty(false)
      await runCode(
        installQueue,
        (js, dts) => {
          setJsCode(js)
          setDtsCode(dts)
        },
        (err) => {
          addToast({ type: 'error', message: err.message })
        }
      )
    },
    [
      jsDirty,
      runCode,
      installQueue,
      setJsCode,
      setDtsCode,
      setJsDirty,
      addToast,
    ]
  )

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeTabs(
    activeTab,
    (tab) => setActiveTab(tab as TabType),
    TABS,
    false
  )

  const handleCopyAll = useCallback(async () => {
    const content =
      activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addToast({ type: 'success', message: 'Copied to clipboard' })
  }, [activeTab, tsCode, jsCode, dtsCode, addToast])

  const handleFormat = useCallback(async () => {
    setFormatting(true)
    await enqueueTask({
      name: 'Format',
      task: async () => {
        const res = await formatAllFiles(tsCode, jsCode, dtsCode)
        setTsCode(res.ts)
        setJsCode(res.js)
        setDtsCode(res.dts)
        setFormatSuccess(true)
        setTimeout(() => setFormatSuccess(false), 2000)
        addToast({ type: 'success', message: 'Code formatted' })
      },
    })
    setFormatting(false)
  }, [
    tsCode,
    jsCode,
    dtsCode,
    setTsCode,
    setJsCode,
    setDtsCode,
    enqueueTask,
    addToast,
  ])

  const handleShare = useCallback(async () => {
    setSharing(true)
    try {
      const url = await getShareUrl(tsCode, tsConfigString)
      await navigator.clipboard.writeText(url)
      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 2000)
      addToast({ type: 'success', message: 'Share link copied!' })
    } catch {
      addToast({ type: 'error', message: 'Failed to create share link' })
    }
    setSharing(false)
  }, [tsCode, tsConfigString, addToast])

  const compactForKeyboard = keyboardOpen && isMobileLike

  return (
    <div
      className='flex flex-col h-screen select-none theme-transition'
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={
        {
          '--panel-height': consoleOpen ? `${panelHeight}rem` : '2.5rem',
        } as React.CSSProperties
      }
    >
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stopCode={stopCode}
        isRunning={isRunning}
        compilerStatus={compilerStatus as any}
        onSettings={() => setShowSettings(true)}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        handleCopyAll={handleCopyAll}
        handleDeleteAll={() => setTsCode('')}
        copied={copied}
        handleFormat={handleFormat}
        formatting={formatting}
        formatSuccess={formatSuccess}
        handleShare={handleShare}
        sharing={sharing}
        shareSuccess={shareSuccess}
        doRun={doRun}
      />
      <StatusBar
        compilerStatus={compilerStatus as any}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={() => tsEditorRef.current?.undo()}
        handleRedo={() => tsEditorRef.current?.redo()}
        onOpenSettings={() => setShowSettings(true)}
        compactForKeyboard={compactForKeyboard}
        lineWrap={true}
        packageManagerStatus={pmStatus as any}
        setLineWrap={() => {}}
      />
      <main className='flex-1 relative flex flex-col min-h-0'>
        <div className='flex-1 relative'>
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-200 z-10',
              activeTab !== 'ts' && 'opacity-0 pointer-events-none z-0'
            )}
          >
            <CodeEditor
              ref={tsEditorRef}
              value={tsCode}
              onChange={(v) => {
                setTsCode(v)
                setJsDirty(true)
              }}
              language='typescript'
              theme={isDarkMode ? 'dark' : 'light'}
              onTypeInfoChange={handleTypeInfoChange}
              onCursorPosChange={setCursorPos}
              diagnostics={diagnostics}
              autoImports={autoImports}
              customAutocomplete={customAutocomplete}
            />
          </div>
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-200 z-10',
              activeTab !== 'js' && 'opacity-0 pointer-events-none z-0'
            )}
          >
            <CodeEditor
              value={jsCode}
              language='javascript'
              theme={isDarkMode ? 'dark' : 'light'}
              readOnly
            />
          </div>
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-200 z-10',
              activeTab !== 'dts' && 'opacity-0 pointer-events-none z-0'
            )}
          >
            <CodeEditor
              value={dtsCode}
              language='typescript'
              theme={isDarkMode ? 'dark' : 'light'}
              readOnly
            />
          </div>
        </div>
        {!compactForKeyboard && (
          <div className='h-6 flex items-center px-3 bg-mantle border-t border-surface0 text-xxs font-mono truncate shrink-0 text-subtext1'>
            {typeInfo || 'Ready'} | Ln {cursorPos.line}, Col {cursorPos.col}
          </div>
        )}
      </main>
      {!compactForKeyboard && (
        <div className='flex flex-col bg-crust relative shrink-0 h-[var(--panel-height)]'>
          <div
            className={cn(
              'h-1 cursor-ns-resize hover:bg-lavender/30 absolute -top-0.5 left-0 right-0 z-50',
              !consoleOpen && 'hidden'
            )}
            onMouseDown={startResizing}
          />
          <Console
            messages={messages as any}
            isOpen={consoleOpen}
            onClear={clearMessages}
            onToggle={toggleConsole}
            activeTab={activeBottomTab}
            onTabChange={(t) => {
              setActiveBottomTab(t)
              if (!consoleOpen) toggleConsole()
            }}
            problemCount={diagnostics.length}
          />
          <Problems
            diagnostics={diagnostics as any}
            isOpen={consoleOpen && activeBottomTab === 'problems'}
            contentHeight={panelHeight}
            onJumpToProblem={(l) => {
              setActiveTab('ts')
              tsEditorRef.current?.jumpTo(l, 1)
            }}
          />
          <PackageManager
            packages={installedPackages}
            isOpen={consoleOpen && activeBottomTab === 'packages'}
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
      />
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
      />
    </div>
  )
}
