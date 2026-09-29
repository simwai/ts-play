import { useState, useEffect, useRef, useCallback } from 'react'
import { type ThemeMode } from './lib/theme'
import { type CodeEditorRef } from './components/CodeEditor'
import { EditorPanels } from './components/EditorPanels'
import { BottomPanels } from './components/BottomPanels'
import { OverrideModal } from './components/Modal'
import { Header } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { SettingsModal } from './components/SettingsModal'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { formatAllFiles } from './lib/formatter'
import { workerClient } from './lib/workerClient'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useResizePanel } from './hooks/useResizePanel'
import { useSwipeTabs } from './hooks/useSwipeTabs'
import { shareSnippet } from './lib/api'
import { useConsoleManager } from './hooks/useConsoleManager'
import { useCompilerManager } from './hooks/useCompilerManager'
import { usePackageManager } from './hooks/usePackageManager'
import { useMonacoCompilerOptions } from './hooks/useMonacoCompilerOptions'
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts'
import { useSharedSnippetLoader } from './hooks/useSharedSnippetLoader'
import { TABS, type TabType, DEFAULT_TSCONFIG } from './lib/constants'
import { playgroundStore } from './lib/state-manager'
import { ToastContainer } from './components/ui/Toast'
import { TypeInfoBar } from './components/ui/TypeInfoBar'
import type { TSDiagnostic, ToastMessage, TypeInfo } from './lib/types'
import { getWebContainer } from './lib/webcontainer'
import { DEFAULT_TS } from './lib/defaultSnippet'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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

  const { messages, addMessage, clearMessages, consoleOpen } =
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

  useMonacoCompilerOptions(tsConfigString)
  useAppKeyboardShortcuts(setActiveTab)
  useSharedSnippetLoader({ setTsCode, setJsCode, addMessage })

  useEffect(() => {
    ;(async () => {
      try {
        const instance = await getWebContainer()
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
      } catch (error) {
        console.warn('WebContainer boot interrupted:', error)
      }
    })()
  }, [])

  const handleCopyAll = useCallback(async () => {
    let content = ''
    if (activeTab === 'ts') content = tsCode
    else if (activeTab === 'js') content = jsCode
    else if (activeTab === 'dts') content = dtsCode

    try {
      await navigator.clipboard.writeText(content)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = content
      document.body.append(textArea)
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
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
        const currentTs = tsEditorRef.current?.getValue() || tsCode
        const currentJs = jsEditorRef.current?.getValue() || jsCode
        const currentDts = dtsEditorRef.current?.getValue() || dtsCode
        const {
          tsCode: formattedTs,
          jsCode: formattedJs,
          dtsCode: formattedDts,
          errors,
        } = await formatAllFiles(currentTs, currentJs, currentDts)

        setTsCode(formattedTs)
        setJsCode(formattedJs)
        setDtsCode(formattedDts)

        const hasFormatErrors = errors.length > 0
        if (hasFormatErrors) {
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
        const msg = getErrorMessage(error)
        playgroundStore.addToast('error', `Format failed: ${msg}`)
      } finally {
        setFormatting(false)
      }
    })
  }, [tsCode, jsCode, dtsCode, setTsCode, setJsCode, setDtsCode])

  const handleJsChange = useCallback(
    (value: string) => {
      setJsCode(value)
      setJsDirty(true)
    },
    [setJsCode]
  )

  const doRun = useCallback(
    async (skipDirtyCheck = false) => {
      const requiresConfirmation = !skipDirtyCheck && jsDirty
      if (requiresConfirmation) {
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
        const isServerResult = result.type === 'server'
        if (isServerResult) {
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
        const msg = getErrorMessage(error)
        playgroundStore.addToast('error', `Failed to share: ${msg}`)
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
    [checkImports, tsCursorPos]
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

  const isBottomPanelVisible = !compactForKeyboard && (consoleOpen || packageManagerOpen)
  const isBottomSectionRendered = !compactForKeyboard

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

      <EditorPanels
        activeTab={activeTab}
        tsEditorRef={tsEditorRef}
        jsEditorRef={jsEditorRef}
        dtsEditorRef={dtsEditorRef}
        tsCode={tsCode}
        setTsCode={setTsCode}
        jsCode={jsCode}
        handleJsChange={handleJsChange}
        dtsCode={dtsCode}
        setDtsCode={setDtsCode}
        onTsCursorChange={onTsCursorChange}
        setCursorPos={setCursorPos}
        setTypeInfo={setTypeInfo}
        setMonacoDiagnostics={setMonacoDiagnostics}
        packageTypings={packageTypings}
        isMobileLike={isMobileLike}
        lineWrap={lineWrap}
        themeMode={themeMode}
      />

      <TypeInfoBar
        typeInfo={typeInfo}
        cursorPos={cursorPos}
        language={activeTab === 'js' ? 'javascript' : 'typescript'}
      />

      <BottomPanels
        isBottomSectionRendered={isBottomSectionRendered}
        isBottomPanelVisible={isBottomPanelVisible}
        isResizing={isResizing}
        handleResizeStart={handleResizeStart}
        panelHeight={panelHeight}
        messages={messages}
        clearMessages={clearMessages}
        consoleOpen={consoleOpen}
        setPackageManagerOpen={setPackageManagerOpen}
        trueColorEnabled={trueColorEnabled}
        showNodeWarnings={showNodeWarnings}
        activeBottomTab={activeBottomTab}
        setActiveBottomTab={setActiveBottomTab}
        monacoDiagnostics={monacoDiagnostics}
        handleJumpToProblem={handleJumpToProblem}
        installedPackages={installedPackages}
      />

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
