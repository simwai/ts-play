import { useCallback, useMemo, useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from './components/CodeEditor';
import { Console } from './components/Console';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { StatusBar } from './components/StatusBar';
import { type TypeInfo, TypeInfoBar } from './components/ui/TypeInfoBar';
import { useCompilerManager } from './hooks/useCompilerManager';
import { useConsoleManager } from './hooks/useConsoleManager';
import { usePackageManager } from './hooks/usePackageManager';
import { usePlaygroundStore } from './hooks/usePlaygroundStore';
import { useResizePanel } from './hooks/useResizePanel';
import { useSwipeTabs } from './hooks/useSwipeTabs';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { useWebContainer } from './hooks/useWebContainer';
import { shareSnippet } from './lib/api';
import { DEFAULT_TSCONFIG, TABS, type TabType } from './lib/constants';
import { formatAllFiles } from './lib/formatter';
import { playgroundStore } from './lib/state-manager';
import { isDarkMode } from './lib/theme';

const DEFAULT_TS = `// TypeScript Playground
// Powered by Node.js, Prettier and WebContainers! ✨

import { map } from 'lodash-es';

interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}

console.log(greet({ name: "Alice", age: 30 }));
console.log("Mapped:", map([1, 2, 3], x => x * 2));
`;

export function App() {
  const {
    theme,
    lineWrap,
    stripAnsi,
    isReady,
    tscStatus,
    esbuildStatus,
    lifecycle,
    packageManagerStatus,
  } = usePlaygroundStore();

  const [tsCode, setTsCode] = useState(DEFAULT_TS);
  const [jsCode, setJsCode] = useState('');
  const [dtsCode, setDtsCode] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ts');
  const [tsConfigString, setTsConfigString] = useState(
    () => localStorage.getItem('tsplay_tsconfig') || DEFAULT_TSCONFIG,
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFormatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsDirty, setJsDirty] = useState(false);
  const [typeInfo, setTypeInfo] = useState<TypeInfo | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const editorRef = useRef<CodeEditorHandle>(null);

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager();

  const handleArtifactsChange = useCallback(
    (js: string, dts: string) => {
      // If JS is dirty, we don't overwrite it with auto-emitted code
      if (js) {
        setJsCode((prev) => (jsDirty ? prev : js));
      }
      if (dts) setDtsCode(dts);
    },
    [jsDirty],
  );

  const { externalTypings } = useWebContainer(
    tsConfigString,
    tsCode,
    addMessage,
    handleArtifactsChange,
  );

  const { tsCursorPos } = usePackageManager(tsCode, addMessage);

  const statusText = useMemo(() => {
    const parts = [];
    if (tscStatus === 'Running' || tscStatus === 'Compiling')
      parts.push('TS...');
    else if (tscStatus === 'Ready') parts.push('TS Ready');
    else if (tscStatus === 'Preparing') parts.push('TS Prep');
    else if (tscStatus === 'Error') parts.push('TS Error');

    if (esbuildStatus === 'Running' || esbuildStatus === 'Compiling')
      parts.push('JS...');
    else if (esbuildStatus === 'Ready') parts.push('JS Ready');
    else if (esbuildStatus === 'Preparing') parts.push('JS Prep');
    else if (esbuildStatus === 'Error') parts.push('JS Error');

    return parts.join(' | ') || 'Idle';
  }, [tscStatus, esbuildStatus]);

  const { runCode, stopCode, isRunning } = useCompilerManager();

  const handleRun = useCallback(async () => {
    if (jsDirty) {
      if (
        !confirm(
          'The JavaScript code has been modified. Running will overwrite your changes with the latest compiled code. Continue?',
        )
      ) {
        return;
      }
      setJsDirty(false);
    }
    runCode();
  }, [jsDirty, runCode]);

  const handleCopyAll = useCallback(() => {
    const code =
      activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeTab, tsCode, jsCode, dtsCode]);

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('');
    else if (activeTab === 'js') {
      setJsCode('');
      setJsDirty(false);
    } else setDtsCode('');
  }, [activeTab]);

  const handleFormat = useCallback(async () => {
    setFormatting(true);
    try {
      const fTs = await formatAllFiles(tsCode, '', '');
      setTsCode(fTs.tsCode);
    } catch (err) {
      console.error('Format failed:', err);
    } finally {
      setFormatting(false);
    }
  }, [tsCode]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const url = await shareSnippet(tsCode, tsConfigString);
      await navigator.clipboard.writeText(url);
      addMessage('info', ['Share URL copied to clipboard!']);
    } catch (err) {
      addMessage('error', [
        `Failed to share snippet: ${(err as Error).message}`,
      ]);
    } finally {
      setIsSharing(false);
    }
  }, [tsCode, tsConfigString, addMessage]);

  const handleSaveTsConfig = (val: string) => {
    setTsConfigString(val);
    localStorage.setItem('tsplay_tsconfig', val);
  };

  useSwipeTabs(TABS, activeTab, (tab) => setActiveTab(tab as TabType));
  const { compactForKeyboard, isMobileLike } = useVirtualKeyboard();
  const { panelHeight, isResizing, handleResizeStart } = useResizePanel(11.25);

  return (
    <div
      className={`h-[100dvh] flex flex-col bg-crust text-text transition-colors duration-300 ${isDarkMode(theme) ? 'dark' : ''}`}
    >
      <Header
        onShare={handleShare}
        onFormat={handleFormat}
        handleCopyAll={handleCopyAll}
        copied={copied}
        handleDeleteAll={handleDeleteAll}
        onSettings={() => setIsSettingsOpen(true)}
        doRun={handleRun}
        stopCode={stopCode}
        sharing={isSharing}
        formatting={isFormatting}
        isRunning={isRunning}
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as TabType)}
        themeMode={theme}
        setThemeMode={(t) =>
          playgroundStore.setState({
            theme: typeof t === 'function' ? t(theme) : t,
          })
        }
        compilerStatus={
          isReady
            ? 'ready'
            : lifecycle === 'error' ||
                tscStatus === 'Error' ||
                esbuildStatus === 'Error'
              ? 'error'
              : 'loading'
        }
        formatSuccess={false}
        shareSuccess={false}
      />

      <StatusBar
        statusText={statusText}
        activeTab={activeTab}
        jsDirty={jsDirty}
        handleUndo={() => editorRef.current?.undo()}
        handleRedo={() => editorRef.current?.redo()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        compactForKeyboard={compactForKeyboard}
        packageManagerStatus={packageManagerStatus}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative border-t border-surface0/50">
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            ref={editorRef}
            language={
              activeTab === 'ts'
                ? 'typescript'
                : activeTab === 'js'
                  ? 'javascript'
                  : 'typescript'
            }
            value={
              activeTab === 'ts'
                ? tsCode
                : activeTab === 'js'
                  ? jsCode
                  : dtsCode
            }
            onChange={(val) => {
              if (activeTab === 'ts') setTsCode(val);
              else if (activeTab === 'js') {
                setJsCode(val);
                setJsDirty(true);
              } else setDtsCode(val);
            }}
            onCursorChange={(offset) => {
              if (activeTab === 'ts') tsCursorPos.current = offset;
            }}
            onTypeInfoChange={setTypeInfo}
            onCursorPosChange={setCursorPos}
            path={
              activeTab === 'ts'
                ? 'index.ts'
                : activeTab === 'js'
                  ? 'index.js'
                  : 'index.d.ts'
            }
            lineWrap={lineWrap}
            themeMode={theme}
            readOnly={activeTab === 'dts'}
            extraLibs={externalTypings}
            isMobileLike={isMobileLike}
          />
        </div>

        {/* Type Info Bar */}
        <div className="relative flex flex-col shrink-0">
          <TypeInfoBar
            typeInfo={typeInfo}
            language={activeTab === 'ts' ? 'typescript' : 'javascript'}
            themeMode={theme}
          />
          <div className="absolute right-4 top-1.5 text-xxs font-mono text-overlay1 opacity-50 pointer-events-none">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </div>
        </div>

        {/* Resizer */}
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className="h-1.5 w-full bg-surface0/30 hover:bg-mauve/40 cursor-ns-resize transition-colors duration-200 z-50 flex items-center justify-center relative"
        >
          <div className="w-8 h-0.5 bg-overlay0/20 rounded-full" />
        </div>

        <div
          style={{ height: `${panelHeight}rem` }}
          className="flex flex-col bg-mantle overflow-hidden"
        >
          <Console
            messages={messages}
            onClear={clearMessages}
            isOpen={consoleOpen}
            onToggle={toggleConsole}
            contentHeight={panelHeight}
            stripAnsiEnabled={stripAnsi}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        tsConfigString={tsConfigString}
        onSave={handleSaveTsConfig}
      />
    </div>
  );
}
