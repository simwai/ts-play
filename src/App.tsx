import { useState, useEffect, useRef, useCallback } from 'react';
import { getTheme, ThemeMode, CatppuccinTheme } from './lib/theme';
import { CodeEditor } from './components/CodeEditor';
import { Console, ConsoleMessage } from './components/Console';
import { OverrideModal } from './components/Modal';
import { PackageManager, InstalledPackage } from './components/PackageManager';
import { Button } from './components/ui/Button';
import { IconButton } from './components/ui/IconButton';
import { syncNodeModulesToWorker } from './lib/typings';
import { decodeSharePayload, encodeSharePayload } from './lib/shareCodec';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { formatAllFiles, loadPrettier } from './lib/formatter';
import { Sun, Moon, Copy, Check, Trash2, Wand2, Loader2, Play, Share2 } from 'lucide-react';
import { workerClient } from './lib/workerClient';
import { writeFiles, runCommand, getWebContainer } from './lib/webcontainer';

const FONT = "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

const DEFAULT_TS = `// TypeScript Playground
// Long-press any word on mobile to see type info ✨

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

// Generics
function identity<T>(value: T): T {
  return value;
}

const result = identity<number>(42);
console.log("Identity:", result);

// Async / await
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}

console.log("Type:", typeof fetchData);
`;

// ── Custom Hooks (Kent C. Dodds Style Refactoring) ────────────────────────────

function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);

  const addMessage = useCallback((type: ConsoleMessage['type'], args: unknown[]) => {
    if (type === 'error' && args.some(a => typeof a === 'string' && a.includes('Maximum update depth exceeded'))) {
      return;
    }
    const formatted = args.map(a => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    });
    setMessages(prev => [...prev, { type, args: formatted, ts: Date.now() }].slice(-500));
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);
  
  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setConsoleOpen(o => !o);
  }, []);

  useEffect(() => {
    const origLog   = console.log;
    const origError = console.error;
    const origWarn  = console.warn;
    const origInfo  = console.info;
    const origDebug = console.debug;
    const origTrace = console.trace;
    const origDir   = console.dir;

    console.log   = (...a) => { addMessage('log',   a); origLog(...a); };
    console.error = (...a) => { addMessage('error', a); origError(...a); };
    console.warn  = (...a) => { addMessage('warn',  a); origWarn(...a); };
    console.info  = (...a) => { addMessage('info',  a); origInfo(...a); };
    console.debug = (...a) => { addMessage('debug', a); origDebug(...a); };
    console.trace = (...a) => { addMessage('trace', a); origTrace(...a); };
    console.dir   = (...a) => { addMessage('dir',   a); origDir(...a); };

    return () => {
      console.log   = origLog;
      console.error = origError;
      console.warn  = origWarn;
      console.info  = origInfo;
      console.debug = origDebug;
      console.trace = origTrace;
      console.dir   = origDir;
    };
  }, [addMessage]);

  return { messages, addMessage, clearMessages, consoleOpen, toggleConsole };
}

function useCompilerManager(tsCode: string, addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void) {
  const [compilerStatus, setCompilerStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    workerClient.init()
      .then(() => setCompilerStatus('ready'))
      .catch((e) => {
        console.error("Worker init failed:", e);
        setCompilerStatus('error');
      });
  }, []);

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {/* silent */});
    }
  }, [compilerStatus]);

  const runCode = useCallback(async (
    pendingInstalls: Promise<void>,
    onSuccess: (js: string, dts: string) => void,
    onError: (err: Error) => void
  ) => {
    setIsRunning(true);
    try {
      const compiled = await workerClient.compile(tsCode);
      onSuccess(compiled.js, compiled.dts);
      
      await writeFiles({
        'index.js': compiled.js
      });

      // Wait for any background npm installs/uninstalls to finish
      await pendingInstalls;

      addMessage('info', ['Executing via Node.js...']);
      const exitCode = await runCommand('node', ['index.js'], (out) => {
        const clean = out.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (clean) addMessage('log', [clean]);
      });

      if (exitCode !== 0) {
        addMessage('error', [`Process exited with code ${exitCode}`]);
      }
    } catch (e) {
      onError(e as Error);
    } finally {
      setIsRunning(false);
    }
  }, [tsCode, addMessage]);

  return { compilerStatus, isRunning, runCode };
}

// ── App ───────────────────────────────────────────────────────────────────────
export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('mocha');
  const [theme, setTheme] = useState<CatppuccinTheme>(getTheme('mocha'));

  const [tsCode, setTsCode] = useState(DEFAULT_TS);
  const [jsCode, setJsCode] = useState('// Press Run to compile TypeScript →');
  const [dtsCode, setDtsCode] = useState('// .d.ts declarations will appear here');
  const [activeTab, setActiveTab] = useState<'ts' | 'js' | 'dts'>('ts');

  const [jsDirty, setJsDirty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>({});

  const prevPkgsRef = useRef<Set<string>>(new Set());
  const installQueue = useRef<Promise<void>>(Promise.resolve());

  const [panelHeight, setPanelHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  
  const [packageManagerOpen, setPackageManagerOpen] = useState(false);
  const { keyboardOpen, keyboardHeight, isMobileLike } = useVirtualKeyboard();
  const compactForKeyboard = keyboardOpen && isMobileLike;

  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [formatSuccess, setFormatSuccess] = useState(false);

  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  // Custom Hooks
  const { messages, addMessage, clearMessages, consoleOpen, toggleConsole } = useConsoleManager();
  const { compilerStatus, isRunning, runCode } = useCompilerManager(tsCode, addMessage);

  // Global Keyboard Shortcuts (Tab Switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';
      
      // Switch tabs with ArrowLeft/ArrowRight. 
      // If focused in an editor, require Alt key to prevent breaking text navigation.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && (!isInput || e.altKey)) {
        e.preventDefault();
        setActiveTab(prev => {
          const tabs: ('ts' | 'js' | 'dts')[] = ['ts', 'js', 'dts'];
          const idx = tabs.indexOf(prev);
          if (e.key === 'ArrowLeft') {
            return tabs[(idx - 1 + tabs.length) % tabs.length];
          } else {
            return tabs[(idx + 1) % tabs.length];
          }
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize base package.json for WebContainer
  useEffect(() => {
    getWebContainer().then(async (instance) => {
      try {
        await instance.fs.readFile('package.json', 'utf-8');
      } catch {
        await instance.fs.writeFile('package.json', JSON.stringify({ name: 'playground', type: 'module' }, null, 2));
      }
    });
  }, []);

  // Auto-detect imports via Worker
  const tsCursorPos = useRef(0);
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current);
    checkImportsTimeout.current = setTimeout(async () => {
      const lines = tsCode.split('\n');
      const cursorLineIdx = tsCode.slice(0, tsCursorPos.current).split('\n').length - 1;
      const currentLine = lines[cursorLineIdx] || '';

      // Delay detection if the user is actively editing an import line
      if (/\bimport\b/.test(currentLine)) {
        return;
      }

      try {
        const detected = await workerClient.detectImports(tsCode);
        setInstalledPackages(prev => {
          const prevNames = prev.map(p => p.name).sort().join(',');
          const newNames = [...detected].sort().join(',');
          if (prevNames === newNames) return prev;
          return detected.map(name => ({ name, version: 'latest' }));
        });
      } catch (e) {
        console.error("Failed to detect imports:", e);
      }
    }, 500);
  }, [tsCode]);

  useEffect(() => {
    checkImports();
  }, [tsCode, checkImports]);

  // Background NPM Install/Uninstall Queue
  useEffect(() => {
    const currentNames = new Set(installedPackages.map(p => p.name));
    const prevNames = prevPkgsRef.current;

    const added = [...currentNames].filter(x => !prevNames.has(x));
    const removed = [...prevNames].filter(x => !currentNames.has(x));

    if (added.length === 0 && removed.length === 0) return;

    prevPkgsRef.current = currentNames;

    if (added.length > 0) {
      installQueue.current = installQueue.current.then(async () => {
        addMessage('info', [`npm install ${added.join(' ')}...`]);
        const code = await runCommand('npm', ['install', '--no-progress', ...added], (out) => {
          const clean = out.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
          if (clean && !/^[\/\\|\-]$/.test(clean)) addMessage('info', [clean]);
        });
        if (code !== 0) {
          addMessage('error', [`npm install failed with code ${code}`]);
        } else {
          const libs = await syncNodeModulesToWorker();
          setPackageTypings(libs);
        }
      }).catch(err => {
        addMessage('error', [`npm install error: ${err.message}`]);
      });
    }

    if (removed.length > 0) {
      installQueue.current = installQueue.current.then(async () => {
        addMessage('info', [`npm uninstall ${removed.join(' ')}...`]);
        const code = await runCommand('npm', ['uninstall', '--no-progress', ...removed], (out) => {
          const clean = out.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
          if (clean && !/^[\/\\|\-]$/.test(clean)) addMessage('info', [clean]);
        });
        if (code !== 0) {
          addMessage('error', [`npm uninstall failed with code ${code}`]);
        } else {
          const libs = await syncNodeModulesToWorker();
          setPackageTypings(libs);
        }
      }).catch(err => {
        addMessage('error', [`npm uninstall error: ${err.message}`]);
      });
    }
  }, [installedPackages, addMessage]);

  const getApiCandidates = useCallback((path: string) => {
    const normalized = path.replace(/^\/+/, '');
    const base = new URL(document.baseURI || window.location.href);
    const currentDir = new URL('./', window.location.href);
    const candidates = [
      new URL(normalized, base).toString(),
      new URL(normalized, currentDir).toString(),
      `${window.location.origin}/${normalized}`,
    ];
    return Array.from(new Set(candidates));
  }, []);

  const fetchApiJson = useCallback(async (path: string, init?: RequestInit) => {
    const candidates = getApiCandidates(path);
    let lastError: Error | null = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, init);
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          const preview = text.slice(0, 300).replace(/\n/g, ' ');
          if (!res.ok) {
            lastError = new Error(`Share API failed (${res.status} ${res.statusText}) at ${url}. Raw response: ${preview}...`);
            continue;
          }
          lastError = new Error(`Share API returned invalid JSON at ${url}. Raw response: ${preview}...`);
          continue;
        }

        if (!res.ok) {
          lastError = new Error(data?.error || `Share API failed (${res.status}).`);
          continue;
        }

        return data;
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw lastError ?? new Error('Share service unavailable. Ensure the PHP API is served correctly.');
  }, [getApiCandidates]);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!consoleOpen && !packageManagerOpen) return;
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeStartHeight.current = panelHeight;
  }, [panelHeight, consoleOpen, packageManagerOpen]);

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = resizeStartY.current - clientY;
    const newHeight = Math.max(80, Math.min(400, resizeStartHeight.current + deltaY));
    setPanelHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      window.addEventListener('touchmove', handleResizeMove, { passive: false });
      window.addEventListener('touchend', handleResizeEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    setTheme(getTheme(themeMode));
  }, [themeMode]);

  useEffect(() => {
    document.body.style.backgroundColor = theme.crust;
    document.body.style.margin = '0';
  }, [theme]);

  const getApiUrl = useCallback((path: string) => {
    return new URL(path.replace(/^\//, ''), document.baseURI).toString();
  }, []);

  const parseJsonResponse = useCallback(async (res: Response) => {
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.slice(0, 300).replace(/\n/g, ' ');
      throw new Error(
        res.ok
          ? `Share API returned invalid JSON. Raw response: ${preview}...`
          : `Share API failed (${res.status}). Raw response: ${preview}...`
      );
    }
    if (!res.ok) {
      throw new Error(data?.error || `Request failed with status ${res.status}`);
    }
    return data;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedded = params.get('code') || window.location.hash.replace(/^#code=/, '');
    if (embedded) {
      decodeSharePayload(embedded)
        .then((payload) => {
          setTsCode(payload.tsCode || '');
          setJsCode(payload.jsCode || '');
          addMessage('info', ['Loaded embedded share link (client-side, no server storage).']);
        })
        .catch((err) => {
          addMessage('error', [`Failed to load embedded share link: ${err.message}`]);
        });
      return;
    }

    const shareId = params.get('share');
    if (shareId) {
      fetch(getApiUrl(`api/get.php?id=${encodeURIComponent(shareId)}`))
        .then(parseJsonResponse)
        .then(data => {
          if (data.success) {
            setTsCode(data.tsCode);
            if (data.jsCode) setJsCode(data.jsCode);
            addMessage('info', [`✓ Loaded shared snippet (${data.remainingDays} days remaining)`]);
            const url = new URL(window.location.href);
            url.searchParams.delete('share');
            window.history.replaceState({}, '', url.toString());
          } else {
            addMessage('error', [`Failed to load shared snippet: ${data.error}`]);
          }
        })
        .catch(err => {
          addMessage('error', [`Failed to load shared snippet: ${err.message}`]);
        });
    }
  }, [addMessage, fetchApiJson, getApiUrl, parseJsonResponse]);

  const handleCopyAll = useCallback(() => {
    const code = activeTab === 'ts' ? tsCode : activeTab === 'js' ? jsCode : dtsCode;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeTab, tsCode, jsCode, dtsCode]);

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') {
      setTsCode('');
    } else if (activeTab === 'js') {
      setJsCode('');
      setJsDirty(false);
    } else {
      setDtsCode('');
    }
  }, [activeTab]);

  const handleFormat = useCallback(async () => {
    setFormatting(true);
    try {
      const { tsCode: fTs, jsCode: fJs, dtsCode: fDts, errors } = await formatAllFiles(tsCode, jsCode, dtsCode);
      setTsCode(fTs);
      setJsCode(fJs);
      setDtsCode(fDts);
      if (errors.length > 0) {
        addMessage('warn', [`Format had issues: ${errors.join(', ')}`]);
      } else {
        setFormatSuccess(true);
        addMessage('info', ['✓ All files formatted with Prettier']);
        setTimeout(() => setFormatSuccess(false), 1500);
      }
    } catch (e) {
      addMessage('error', [`Format failed: ${(e as Error).message}`]);
    } finally {
      setFormatting(false);
    }
  }, [tsCode, jsCode, dtsCode, addMessage]);

  const doRun = useCallback(async (skipDirtyCheck = false) => {
    if (!skipDirtyCheck && jsDirty) { setShowModal(true); return; }
    setShowModal(false);
    clearMessages();

    runCode(
      installQueue.current,
      (js, dts) => {
        setJsCode(js);
        setDtsCode(dts);
        setJsDirty(false);
      },
      (err) => {
        addMessage('error', [`Compilation error: ${err.message}`]);
      }
    );
  }, [jsDirty, runCode, clearMessages, addMessage]);

  const isEditorTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('textarea');
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (compactForKeyboard) return;
    if (isEditorTarget(e.target)) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }, [compactForKeyboard]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (compactForKeyboard) return;
    if (isEditorTarget(e.target)) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      swiping.current = true;
    }
    if (swiping.current) e.preventDefault();
  }, [compactForKeyboard]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (compactForKeyboard) return;
    if (isEditorTarget(e.target)) return;
    if (!swiping.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (Math.abs(dx) < 40) return;

    const tabs: ('ts' | 'js' | 'dts')[] = ['ts', 'js', 'dts'];
    const currentIndex = tabs.indexOf(activeTab);
    
    if (dx < 0) {
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    } else {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveTab(tabs[prevIndex]);
    }
    swiping.current = false;
  }, [activeTab, compactForKeyboard]);

  const togglePackageManager = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setPackageManagerOpen(o => !o);
  }, []);

  const t = theme;

  const statusLabel = compilerStatus === 'loading' ? '⏳ Loading…'
    : compilerStatus === 'error' ? '✗ No compiler'
    : '✓ TS ready';
  const statusColor = compilerStatus === 'ready' ? t.green
    : compilerStatus === 'error' ? t.red
    : t.yellow;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: t.base,
      color: t.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 6px',
        height: 36,
        background: t.mantle,
        borderBottom: `1px solid ${t.surface0}`,
        flexShrink: 0,
        gap: 4,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: t.text,
            letterSpacing: '-0.02em',
            fontFamily: FONT,
          }}>
            TS<span style={{ color: t.mauve }}>Play</span>
          </span>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: t.surface0,
          borderRadius: 5,
          padding: 1,
          gap: 1,
          flexShrink: 1,
        }}>
          {(['ts', 'js', 'dts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: 'none',
                fontSize: 9,
                fontWeight: 600,
                fontFamily: FONT,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                background: activeTab === tab ? t.base : 'transparent',
                color: activeTab === tab ? t.text : t.overlay1,
                transition: 'all 160ms',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {/* Theme toggle */}
          <IconButton
            onClick={() => setThemeMode(m => m === 'mocha' ? 'latte' : 'mocha')}
            title={themeMode === 'mocha' ? 'Switch to Latte (light)' : 'Switch to Mocha (dark)'}
            theme={t}
            size="sm"
            variant="surface"
            style={{ minWidth: 22, height: 22, borderRadius: 4, padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {themeMode === 'mocha' ? <Sun size={14} /> : <Moon size={14} />}
          </IconButton>

          {/* Separator */}
          <div style={{ width: 1, height: 10, background: t.surface1, flexShrink: 0 }} />

          {/* Copy all */}
          <IconButton
            onClick={handleCopyAll}
            title={`Copy all ${activeTab}`}
            theme={t}
            size="sm"
            variant={copied ? 'surface' : 'surface'}
            style={{
              color: copied ? t.green : t.text,
              borderColor: copied ? t.green : t.surface1,
              background: copied ? `${t.green}15` : t.surface0,
              minWidth: 22,
              height: 22,
              borderRadius: 4,
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>

          {/* Delete all */}
          <IconButton
            onClick={handleDeleteAll}
            title={`Clear ${activeTab} editor`}
            theme={t}
            size="sm"
            variant="surface"
            style={{
              color: t.red,
              borderColor: t.surface1,
              background: t.surface0,
              minWidth: 22,
              height: 22,
              borderRadius: 4,
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={14} />
          </IconButton>

          {/* Format */}
          <IconButton
            onClick={handleFormat}
            disabled={formatting}
            title="Format all files with Prettier (TS + JS + DTS)"
            theme={t}
            size="sm"
            variant="surface"
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 4,
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: formatSuccess ? t.green : formatting ? t.overlay0 : t.mauve,
              borderColor: formatSuccess ? t.green : t.surface1,
              background: formatSuccess ? `${t.green}15` : formatting ? t.surface0 : `${t.mauve}12`,
              transition: 'all 160ms',
            }}
          >
            {formatting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : formatSuccess ? <Check size={14} /> : <Wand2 size={14} />}
          </IconButton>

          {/* Separator */}
          <div style={{ width: 1, height: 10, background: t.surface1, flexShrink: 0 }} />

          {/* Run */}
          <Button
            onClick={() => doRun(false)}
            disabled={isRunning || compilerStatus !== 'ready'}
            variant="primary"
            theme={t}
            title="Run (compile + execute)"
            style={{
              fontFamily:    FONT,
              letterSpacing: '0.02em',
              background:    isRunning || compilerStatus !== 'ready' ? t.surface0 : `${t.green}18`,
              color:         isRunning || compilerStatus !== 'ready' ? t.overlay0 : t.green,
              padding:       '2px 5px 2px 4px',
              height:        22,
              minWidth:      22,
              borderRadius:  4,
              fontSize:      10,
              gap:           4,
              border:        `1px solid ${isRunning || compilerStatus !== 'ready' ? t.surface1 : `${t.green}55`}`,
              boxShadow:     isRunning || compilerStatus !== 'ready' ? 'none' : `inset 0 0 0 1px ${t.green}12`,
            }}
          >
            <span style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isRunning || compilerStatus !== 'ready' ? t.surface1 : `${t.green}22`,
              color: isRunning || compilerStatus !== 'ready' ? t.overlay0 : t.green,
              flexShrink: 0,
            }}>
              {isRunning
                ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />}
            </span>
            <span className="run-label">
              {isRunning ? 'Running…' : 'Run'}
            </span>
          </Button>

          {/* Separator */}
          <div style={{ width: 1, height: 10, background: t.surface1, flexShrink: 0 }} />

          {/* Share */}
          <IconButton
            onClick={async () => {
              setSharing(true);
              try {
                const data = await fetchApiJson('api/share.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    tsCode, 
                    jsCode,
                    packages: installedPackages 
                  })
                });
                if (data.success) {
                  const url = new URL(window.location.href);
                  url.searchParams.set('share', data.id);
                  url.searchParams.delete('code');
                  url.hash = '';
                  const shareUrl = url.toString();
                  await navigator.clipboard.writeText(shareUrl);
                  setShareSuccess(true);
                  addMessage('info', [`✓ Share link copied! Expires in ${data.ttlDays ?? data.expires ?? 7} days`]);
                  setTimeout(() => setShareSuccess(false), 2000);
                } else {
                  throw new Error(data.error || 'Share API returned an error');
                }
              } catch (err) {
                try {
                  const token = await encodeSharePayload({
                    tsCode,
                    jsCode,
                    packages: installedPackages,
                  });
                  const url = new URL(window.location.href);
                  url.searchParams.delete('share');
                  url.searchParams.delete('code');
                  url.hash = `code=${token}`;
                  await navigator.clipboard.writeText(url.toString());
                  setShareSuccess(true);
                  addMessage('warn', [
                    `PHP share unavailable: ${(err as Error).message}`,
                    'Copied embedded compressed link instead. It is stored in the URL itself and has no 7-day TTL.',
                  ]);
                  setTimeout(() => setShareSuccess(false), 2000);
                } catch (fallbackErr) {
                  addMessage('error', [`Failed to share: ${(fallbackErr as Error).message}`]);
                }
              } finally {
                setSharing(false);
              }
            }}
            title={sharing ? 'Sharing...' : 'Share snippet (expires in 7 days)'}
            theme={t}
            size="sm"
            variant={shareSuccess ? 'surface' : 'surface'}
            disabled={sharing}
            style={{ 
              minWidth: 22,
              height: 22,
              borderRadius: 4,
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: shareSuccess ? t.green : t.blue,
              borderColor: shareSuccess ? t.green : t.surface1,
              background: shareSuccess ? `${t.green}15` : t.surface0,
            }}
          >
            {sharing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : shareSuccess ? <Check size={14} /> : <Share2 size={14} />}
          </IconButton>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        height: compactForKeyboard ? 20 : 24,
        background: t.crust,
        borderBottom: `1px solid ${t.surface0}`,
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <span style={{ fontSize: 10, color: statusColor, fontFamily: FONT, letterSpacing: '0.04em' }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, color: t.overlay0, fontFamily: FONT }}>
          {activeTab === 'ts' ? 'TypeScript' : activeTab === 'js' ? 'JavaScript' : 'Declarations'}
          {activeTab === 'js' && jsDirty && (
            <span style={{ marginLeft: 6, color: t.peach }}>● modified</span>
          )}
        </span>
        {!compactForKeyboard && (
          <span style={{ fontSize: 10, color: t.overlay0, fontFamily: FONT }}>
            swipe to switch tabs
          </span>
        )}
      </div>

      {/* ── Editors ── */}
      <div
        ref={swipeRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slider track */}
        <div style={{
          display: 'flex',
          width: '300%',
          height: '100%',
          transform: activeTab === 'ts' ? 'translateX(0)' : activeTab === 'js' ? 'translateX(-33.333%)' : 'translateX(-66.666%)',
          transition: 'transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}>
          {/* TS Editor */}
          <div style={{ width: '33.333%', height: '100%', flexShrink: 0 }}>
            <CodeEditor
              value={tsCode}
              onChange={setTsCode}
              onCursorChange={(pos) => {
                tsCursorPos.current = pos;
                checkImports();
              }}
              language="typescript"
              theme={t}
              extraLibs={packageTypings}
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
          {/* JS Editor */}
          <div style={{ width: '33.333%', height: '100%', flexShrink: 0 }}>
            <CodeEditor
              value={jsCode}
              onChange={v => { setJsCode(v); setJsDirty(true); }}
              language="javascript"
              theme={t}
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
          {/* DTS Editor */}
          <div style={{ width: '33.333%', height: '100%', flexShrink: 0 }}>
            <CodeEditor
              value={dtsCode}
              onChange={setDtsCode}
              language="typescript"
              theme={t}
              readOnly={true}
              keyboardOpen={keyboardOpen}
              keyboardHeight={keyboardHeight}
            />
          </div>
        </div>
      </div>

      {/* ── Resize Divider ── */}
      {!compactForKeyboard && (consoleOpen || packageManagerOpen) && (
        <div
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          style={{
            height: 8,
            background: isResizing ? t.peach : t.surface0,
            borderBottom: `1px solid ${t.surface1}`,
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 160ms',
            position: 'relative',
          }}
          title="Drag to resize"
        >
          <div style={{
            width: 40,
            height: 4,
            background: t.overlay0,
            borderRadius: 2,
            opacity: 0.5,
          }} />
        </div>
      )}

      {/* ── Console & Package Manager Section ── */}
      {!compactForKeyboard && (
      <div style={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: t.base,
      }}>
        {/* ── Console ── */}
        <Console
          messages={messages}
          onClear={clearMessages}
          theme={t}
          isOpen={consoleOpen}
          onToggle={toggleConsole}
          contentHeight={panelHeight}
        />

        {/* ── Package Manager ── */}
        <PackageManager
          theme={t}
          packages={installedPackages}
          isOpen={packageManagerOpen}
          onToggle={togglePackageManager}
          contentHeight={panelHeight}
        />
      </div>
      )}

      {/* ── Override modal ── */}
      {showModal && (
        <OverrideModal
          theme={t}
          onConfirm={() => doRun(true)}
          onCancel={() => setShowModal(false)}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Victor+Mono:ital,wght@0,100..700;1,100..700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        textarea { -webkit-text-fill-color: transparent !important; }
        .run-label { display: none; }
        @media (min-width: 480px) { .run-label { display: inline; } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5); }
        ::selection { background: ${t.surface2}80; }
        ::-moz-selection { background: ${t.surface2}80; }
      `}</style>
    </div>
  );
}
