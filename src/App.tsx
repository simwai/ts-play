import { useState, useCallback } from 'react';
import { type ThemeMode, isDarkMode } from './lib/theme';
import { CodeEditor, type CodeEditorHandle } from './components/CodeEditor';
import { Console } from './components/Console';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { formatAllFiles } from './lib/formatter';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useResizePanel } from './hooks/useResizePanel';
import { useSwipeTabs } from './hooks/useSwipeTabs';
import { shareSnippet } from './lib/api';
import { useConsoleManager } from './hooks/useConsoleManager';
import { useCompilerManager } from './hooks/useCompilerManager';
import { usePackageManager } from './hooks/usePackageManager';
import { useWebContainer } from './hooks/useWebContainer';
import { TABS, type TabType, DEFAULT_TSCONFIG } from './lib/constants';

const DEFAULT_TS = `// TypeScript Playground
// Powered by Vite-Node, Prettier and WebContainers! ✨

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

/**
 * Main Application component for the TypeScript Playground.
 * Manages the layout, global state, and coordinates specialized hooks.
 */
export function App() {
  const [themeMode, setThemeMode] = useLocalStorage<ThemeMode>(
    'tsplay_theme',
    'mocha',
  );
  const [tsCode, setTsCode] = useState(DEFAULT_TS);
  const [jsCode, setJsCode] = useState('');
  const [dtsCode, setDtsCode] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ts');
  const [tsConfigString, setTsConfigString] = useLocalStorage(
    'tsplay_tsconfig',
    DEFAULT_TSCONFIG,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trueColorEnabled, setTrueColorEnabled] = useLocalStorage(
    'tsplay_truecolor',
    true,
  );
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_linewrap', false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFormatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsDirty, setJsDirty] = useState(false);

  // Specialized Hooks
  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } =
    useConsoleManager();
  const { compilerStatus, isRunning, runCode, stopCode } = useCompilerManager(
    tsCode,
    addMessage,
  );
  const {
    installedPackages,
    tsCursorPos,
    checkImports,
    installQueue,
    status: packageManagerStatus,
  } = usePackageManager(tsCode, addMessage);
  const { externalTypings } = useWebContainer(
    tsConfigString,
    tsCode,
    addMessage,
  );

  /**
   * Clipboard actions
   */
  const handleCopyAll = useCallback(() => {
    const code =
      activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeTab, tsCode, jsCode, dtsCode]);

  /**
   * Reset actions
   */
  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('');
    else if (activeTab === 'js') {
      setJsCode('');
      setJsDirty(false);
    } else setDtsCode('');
  }, [activeTab]);

  /**
   * Formatting via WebContainer Prettier
   */
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

  /**
   * Execution via Vite-Node
   */
  const handleRun = useCallback(() => {
    runCode(
      installQueue.current,
      (js, dts) => {
        setJsCode(js);
        setDtsCode(dts);
        setJsDirty(false);
      },
      (err) => {
        addMessage('error', [err.message]);
      },
    );
  }, [runCode, installQueue, addMessage]);

  /**
   * Share functionality
   */
  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const url = await shareSnippet(tsCode, tsConfigString);
      await navigator.clipboard.writeText(url);
      addMessage('info', ['Share URL copied to clipboard!']);
    } catch (err) {
      addMessage('error', [
        'Failed to share snippet: ' + (err as Error).message,
      ]);
    } finally {
      setIsSharing(false);
    }
  }, [tsCode, tsConfigString, addMessage]);

  // Layout and UX Hooks
  useSwipeTabs(TABS, activeTab, (tab) => setActiveTab(tab as TabType));
  useVirtualKeyboard();
  const { height, isResizing, startResizing } = useResizePanel(300);

  return (
    <div
      className={`h-[100dvh] flex flex-col bg-crust text-text transition-colors duration-300 ${isDarkMode(themeMode) ? 'dark' : ''}`}
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
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        compilerStatus={compilerStatus}
        formatSuccess={false}
        shareSuccess={false}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative border-t border-surface0/50">
        <div className="flex-1 overflow-hidden">
          <CodeEditor
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
            onCursorChange={(pos) => {
              if (activeTab === 'ts') tsCursorPos.current = pos;
            }}
            path={
              activeTab === 'ts'
                ? 'index.ts'
                : activeTab === 'js'
                  ? 'index.js'
                  : 'index.d.ts'
            }
            lineWrap={lineWrap}
            themeMode={themeMode}
            readOnly={activeTab === 'dts'}
            extraLibs={externalTypings}
          />
        </div>

        <StatusBar
          compilerStatus={compilerStatus}
          packageManagerStatus={packageManagerStatus}
          isResizing={isResizing}
          onResizeStart={startResizing}
        />

        <Console
          messages={messages}
          onClear={clearMessages}
          isOpen={consoleOpen}
          onToggle={toggleConsole}
          contentHeight={height / 16}
          trueColorEnabled={trueColorEnabled}
        />
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        tsConfigString={tsConfigString}
        onSave={setTsConfigString}
        trueColorEnabled={trueColorEnabled}
        setTrueColorEnabled={setTrueColorEnabled}
        lineWrap={lineWrap}
        setLineWrap={setLineWrap}
        packageManagerStatus={packageManagerStatus}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
      />
    </div>
  );
}
