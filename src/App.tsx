import { useState, useEffect, useRef, useCallback } from 'react';
import { type ThemeMode, isDarkMode } from './lib/theme';
import { CodeEditor, type CodeEditorHandle } from './components/CodeEditor';
import { Console } from './components/Console';
import { OverrideModal } from './components/Modal';
import { PackageManager } from './components/PackageManager';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { decodeSharePayload } from './lib/shareCodec';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { formatAllFiles } from './lib/formatter';
import { workerClient } from './lib/workerClient';
import { getWebContainer, runCommand, markEnvReady, readDirRecursive } from './lib/webcontainer';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useResizePanel } from './hooks/useResizePanel';
import { useSwipeTabs } from './hooks/useSwipeTabs';
import { shareSnippet, loadSharedSnippet } from './lib/api';
import { useConsoleManager } from './hooks/useConsoleManager';
import { useCompilerManager } from './hooks/useCompilerManager';
import { usePackageManager } from './hooks/usePackageManager';
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

export function App() {
  const [themeMode, setThemeMode] = useLocalStorage<ThemeMode>('tsplay_theme', 'mocha');
  const [tsCode, setTsCode] = useState(DEFAULT_TS);
  const [jsCode, setJsCode] = useState('');
  const [dtsCode, setDtsCode] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ts');
  const [tsConfigString, setTsConfigString] = useLocalStorage('tsplay_tsconfig', DEFAULT_TSCONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [trueColorEnabled, setTrueColorEnabled] = useLocalStorage('tsplay_truecolor', true);
  const [lineWrap, setLineWrap] = useLocalStorage('tsplay_linewrap', false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFormatting, setFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jsDirty, setJsDirty] = useState(false);
  const [externalTypings, setExternalTypings] = useState<Record<string, string>>({});

  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } = useConsoleManager();
  const { compilerStatus, isRunning, runCode, stopCode, outputFiles } = useCompilerManager(tsCode, addMessage);
  const { installedPackages, tsCursorPos, checkImports, installQueue, status: packageManagerStatus } = usePackageManager(tsCode, addMessage);

  const isInitialSync = useRef(true);

  // Core WebContainer Lifecycle (Boot -> Install -> Sync Types)
  useEffect(() => {
    getWebContainer().then(async (instance) => {
      try {
        if (isInitialSync.current) {
          isInitialSync.current = false;

          const pkgJson = {
            name: 'playground',
            type: 'module',
            private: true,
            dependencies: {
              'vite-node': '^3.0.0',
              'esbuild': '^0.24.0',
              'prettier': '^3.0.0',
              'typescript': '^5.0.0',
              'lodash-es': '^4.17.21'
            }
          };

          await instance.fs.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
          await instance.fs.writeFile('tsconfig.json', tsConfigString);
          await instance.fs.writeFile('index.ts', tsCode);

          addMessage('info', ['Preparing environment...']);
          const { exit } = await runCommand('npm', ['install', '--no-progress'], (out) => {
             const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
             if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
          });
          const exitCode = await exit;
          if (exitCode === 0) {
            await syncTypes();
            markEnvReady();
            addMessage('info', ['Environment ready.']);
          } else {
             addMessage('error', ['npm install failed. Check console.']);
          }
        }
      } catch (error) {
        console.error('Failed to sync config files to WebContainer:', error);
      }
    });
  }, []);

  const syncTypes = useCallback(async () => {
     try {
       const types = await readDirRecursive('node_modules', (path) => path.endsWith('.d.ts'));
       setExternalTypings(types);
     } catch (err) {
       console.error('Failed to sync types:', err);
     }
  }, []);

  useEffect(() => {
    getWebContainer().then(async (instance) => {
       await instance.fs.writeFile('index.ts', tsCode);
    });
  }, [tsCode]);

  useEffect(() => {
    getWebContainer().then(async (instance) => {
       await instance.fs.writeFile('tsconfig.json', tsConfigString);
    });
  }, [tsConfigString]);

  const handleCopyAll = useCallback(() => {
    const code = activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeTab, tsCode, jsCode, dtsCode]);

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('');
    else if (activeTab === 'js') { setJsCode(''); setJsDirty(false); }
    else setDtsCode('');
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

  const handleRun = useCallback(() => {
    runCode(installQueue.current, (js, dts) => {
      setJsCode(js);
      setDtsCode(dts);
      setJsDirty(false);
    }, (err) => {
      addMessage('error', [err.message]);
    });
  }, [runCode, installQueue, addMessage]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const url = await shareSnippet(tsCode, tsConfigString);
      await navigator.clipboard.writeText(url);
      addMessage('info', ['Share URL copied to clipboard!']);
    } catch (err) {
      addMessage('error', ['Failed to share snippet: ' + (err as Error).message]);
    } finally {
      setIsSharing(false);
    }
  }, [tsCode, tsConfigString, addMessage]);

  useSwipeTabs(TABS, activeTab, (tab) => setActiveTab(tab as TabType));
  useVirtualKeyboard();
  const { height, isResizing, startResizing } = useResizePanel(300);

  return (
    <div className={`h-[100dvh] flex flex-col bg-crust text-text transition-colors duration-300 ${isDarkMode(themeMode) ? 'dark' : ''}`}>
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
            language={activeTab === 'ts' ? 'typescript' : activeTab === 'js' ? 'javascript' : 'typescript'}
            value={activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode}
            onChange={(val) => {
              if (activeTab === 'ts') setTsCode(val);
              else if (activeTab === 'js') { setJsCode(val); setJsDirty(true); }
              else setDtsCode(val);
            }}
            onCursorChange={(pos) => { if (activeTab === 'ts') tsCursorPos.current = pos; }}
            path={activeTab === 'ts' ? 'index.ts' : activeTab === 'js' ? 'index.js' : 'index.d.ts'}
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
