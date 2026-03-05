import { useState, useEffect, useRef, useCallback } from 'react';
import { getTheme, ThemeMode, CatppuccinTheme } from './lib/theme';
import { CodeEditor } from './components/CodeEditor';
import { Console, ConsoleMessage } from './components/Console';
import { OverrideModal } from './components/Modal';
import { PackageManager, InstalledPackage } from './components/PackageManager';

// ── Compiler ────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    ts?: {
      transpileModule: (src: string, opts: object) => { outputText: string };
      ScriptTarget: { ES2020: number };
      ModuleKind: { ESNext: number };
    };
  }
}

let tsReady = false;
let tsError = '';

async function loadTS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (tsReady) { resolve(); return; }
    if (document.querySelector('#ts-cdn')) { resolve(); return; }
    const s = document.createElement('script');
    s.id = 'ts-cdn';
    s.src = 'https://cdn.jsdelivr.net/npm/typescript@5.4.5/lib/typescript.js';
    s.onload = () => { tsReady = true; resolve(); };
    s.onerror = () => { tsError = 'Failed to load TypeScript compiler'; reject(new Error(tsError)); };
    document.head.appendChild(s);
  });
}

function compile(tsCode: string): string {
  if (!window.ts) throw new Error('TypeScript compiler not ready');
  const result = window.ts.transpileModule(tsCode, {
    compilerOptions: {
      target: 99,        // ES2020
      module: 99,        // ESNext
      jsx: 1,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      experimentalDecorators: true,
    },
  });
  return result.outputText;
}

// ── Initial code ─────────────────────────────────────────────────────────────
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

// ── App ───────────────────────────────────────────────────────────────────────
export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('mocha');
  const [theme, setTheme] = useState<CatppuccinTheme>(getTheme('mocha'));

  const [tsCode, setTsCode] = useState(DEFAULT_TS);
  const [jsCode, setJsCode] = useState('// Press Run to compile TypeScript →');
  const [activeTab, setActiveTab] = useState<'ts' | 'js'>('ts');

  const [compilerStatus, setCompilerStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [jsDirty, setJsDirty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Package manager state
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);

  // Resize state for the open panel (whichever is open gets this height)
  const [panelHeight, setPanelHeight] = useState(180); // Height for the open panel body (not header)
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);
  
  // Track which panels are open
  const [packageManagerOpen, setPackageManagerOpen] = useState(false);

  // Swipe state
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  // Resize handlers - only affects the open panel content height
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't allow resize if both panels are closed
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

  // Global event listeners for resize
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

  // Theme
  useEffect(() => {
    setTheme(getTheme(themeMode));
  }, [themeMode]);

  useEffect(() => {
    document.body.style.backgroundColor = theme.crust;
    document.body.style.margin = '0';
  }, [theme]);

  // Load compiler
  useEffect(() => {
    loadTS()
      .then(() => setCompilerStatus('ready'))
      .catch(() => setCompilerStatus('error'));
  }, []);

  // ── Console capture ─────────────────────────────────────────────────────
  const addMessage = useCallback((type: ConsoleMessage['type'], args: unknown[]) => {
    const formatted = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    });
    setMessages(prev => [...prev, { type, args: formatted, ts: Date.now() }]);
  }, []);

  // ── Run ──────────────────────────────────────────────────────────────────
  const doRun = useCallback(async (skipDirtyCheck = false) => {
    if (!skipDirtyCheck && jsDirty) { setShowModal(true); return; }
    setShowModal(false);
    setIsRunning(true);
    setMessages([]);

    let js = '';
    try {
      js = compile(tsCode);
    } catch (e) {
      setMessages([{ type: 'error', args: [`Compilation error: ${(e as Error).message}`], ts: Date.now() }]);
      setIsRunning(false);
      return;
    }

    setJsCode(js);
    setJsDirty(false);

    // Execute
    const origLog   = console.log;
    const origError = console.error;
    const origWarn  = console.warn;
    const origInfo  = console.info;
    console.log   = (...a) => { addMessage('log',   a); origLog(...a); };
    console.error = (...a) => { addMessage('error', a); origError(...a); };
    console.warn  = (...a) => { addMessage('warn',  a); origWarn(...a); };
    console.info  = (...a) => { addMessage('info',  a); origInfo(...a); };

    try {
      const blob = new Blob([js], { type: 'application/javascript' });
      const url  = URL.createObjectURL(blob);
      await import(/* @vite-ignore */ url);
      URL.revokeObjectURL(url);
    } catch (e) {
      addMessage('error', [`Runtime error: ${(e as Error).message}`]);
    } finally {
      console.log   = origLog;
      console.error = origError;
      console.warn  = origWarn;
      console.info  = origInfo;
      setIsRunning(false);
    }
  }, [tsCode, jsDirty, addMessage]);

  // ── Swipe ────────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      swiping.current = true;
    }
    if (swiping.current) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && activeTab === 'ts') setActiveTab('js');
    if (dx > 0 && activeTab === 'js') setActiveTab('ts');
    swiping.current = false;
  }, [activeTab]);

  // ── Package Manager ─────────────────────────────────────────────────────
  const handleAddPackage = useCallback((pkg: InstalledPackage) => {
    setInstalledPackages(prev => [...prev, pkg]);
    
    // Generate import name from package name (e.g., "@tanstack/query" -> "query")
    const importName = pkg.name
      .replace(/^@[^/]+\//, '') // Remove scope
      .replace(/-([a-z])/g, (_, c) => c.toUpperCase()) // Convert kebab-case to camelCase
      .replace(/[^a-zA-Z0-9]/g, ''); // Remove invalid chars
    
    // Inject import at the top of the TypeScript code
    const importLine = `import * as ${importName} from '${pkg.url}';\n`;
    setTsCode(prev => {
      // Check if import already exists
      if (prev.includes(pkg.url)) return prev;
      // Add import at top (after any existing imports or at the very top)
      const importMatch = prev.match(/^((?:import[^;]+;?\n)+)/);
      if (importMatch) {
        return prev.replace(importMatch[0], importMatch[0] + importLine);
      }
      return importLine + prev;
    });
  }, []);

  const handleRemovePackage = useCallback((name: string) => {
    const pkg = installedPackages.find(p => p.name === name);
    if (pkg) {
      // Remove the import line from the TypeScript code
      setTsCode(prev => {
        const regex = new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]${pkg.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?\\n?`, 'g');
        return prev.replace(regex, '');
      });
    }
    setInstalledPackages(prev => prev.filter(p => p.name !== name));
  }, [installedPackages]);

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
        padding: '0 14px',
        height: 48,
        background: t.mantle,
        borderBottom: `1px solid ${t.surface0}`,
        flexShrink: 0,
        gap: 8,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: t.text,
            letterSpacing: '-0.02em',
            fontFamily: 'monospace',
          }}>
            TS<span style={{ color: t.mauve }}>Play</span>
          </span>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: t.surface0,
          borderRadius: 6,
          padding: 2,
          gap: 2,
        }}>
          {(['ts', 'js'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '4px 14px',
                borderRadius: 4,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'monospace',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status */}
          <span style={{
            fontSize: 10,
            color: statusColor,
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
            display: 'none',
          }}
            className="status-wide"
          >
            {statusLabel}
          </span>

          {/* Theme toggle */}
          <button
            onClick={() => setThemeMode(m => m === 'mocha' ? 'latte' : 'mocha')}
            title={themeMode === 'mocha' ? 'Switch to Latte (light)' : 'Switch to Mocha (dark)'}
            style={{
              background: t.surface0,
              border: `1px solid ${t.surface1}`,
              borderRadius: 6,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              color: t.text,
            }}
          >
            {themeMode === 'mocha' ? '☀️' : '🌙'}
          </button>

          {/* Run */}
          <button
            onClick={() => doRun(false)}
            disabled={isRunning || compilerStatus !== 'ready'}
            title="Run (compile + execute)"
            style={{
              background:    isRunning || compilerStatus !== 'ready' ? t.surface1 : t.green,
              border:        'none',
              borderRadius:  6,
              padding:       '6px 12px',
              fontSize:      13,
              fontWeight:    700,
              color:         isRunning || compilerStatus !== 'ready' ? t.overlay0 : t.crust,
              cursor:        isRunning || compilerStatus !== 'ready' ? 'not-allowed' : 'pointer',
              fontFamily:    'monospace',
              letterSpacing: '0.02em',
              display:       'flex',
              alignItems:    'center',
              gap:           5,
              transition:    'all 160ms',
              whiteSpace:    'nowrap',
            }}
          >
            {isRunning
              ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              : '▶'}
            <span className="run-label">
              {isRunning ? 'Running…' : 'Run'}
            </span>
          </button>
        </div>
      </header>

      {/* ── Status bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        height: 24,
        background: t.crust,
        borderBottom: `1px solid ${t.surface0}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: statusColor, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, color: t.overlay0, fontFamily: 'monospace' }}>
          {activeTab === 'ts' ? 'TypeScript' : 'JavaScript'}
          {activeTab === 'js' && jsDirty && (
            <span style={{ marginLeft: 6, color: t.peach }}>● modified</span>
          )}
        </span>
        <span style={{ fontSize: 10, color: t.overlay0, fontFamily: 'monospace' }}>
          hold word → type info
        </span>
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
          width: '200%',
          height: '100%',
          transform: activeTab === 'ts' ? 'translateX(0)' : 'translateX(-50%)',
          transition: 'transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: 'transform',
        }}>
          {/* TS Editor */}
          <div style={{ width: '50%', height: '100%', flexShrink: 0 }}>
            <CodeEditor
              value={tsCode}
              onChange={setTsCode}
              language="typescript"
              theme={t}
            />
          </div>
          {/* JS Editor */}
          <div style={{ width: '50%', height: '100%', flexShrink: 0 }}>
            <CodeEditor
              value={jsCode}
              onChange={v => { setJsCode(v); setJsDirty(true); }}
              language="javascript"
              theme={t}
            />
          </div>
        </div>
      </div>

      {/* ── Resize Divider ── */}
      {(consoleOpen || packageManagerOpen) && (
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
          onClear={() => setMessages([])}
          theme={t}
          isOpen={consoleOpen}
          onToggle={() => setConsoleOpen(o => !o)}
          contentHeight={panelHeight}
        />

        {/* ── Package Manager ── */}
        <PackageManager
          theme={t}
          packages={installedPackages}
          onAddPackage={handleAddPackage}
          onRemovePackage={handleRemovePackage}
          isOpen={packageManagerOpen}
          onToggle={() => setPackageManagerOpen(o => !o)}
          contentHeight={panelHeight}
        />
      </div>

      {/* ── Override modal ── */}
      {showModal && (
        <OverrideModal
          theme={t}
          onConfirm={() => doRun(true)}
          onCancel={() => setShowModal(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        textarea { -webkit-text-fill-color: transparent !important; }
        /* Hide run label on small screens */
        .run-label { display: none; }
        @media (min-width: 480px) { .run-label { display: inline; } }
        /* Smooth scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5); }
      `}</style>
    </div>
  );
}
