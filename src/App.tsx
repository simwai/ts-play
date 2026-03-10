import { useState, useEffect, useRef, useCallback } from 'react';
import { getTheme, ThemeMode, CatppuccinTheme } from './lib/theme';
import { CodeEditor } from './components/CodeEditor';
import { Console, ConsoleMessage } from './components/Console';
import { OverrideModal } from './components/Modal';
import { PackageManager, InstalledPackage } from './components/PackageManager';
import { Button } from './components/ui/Button';
import { IconButton } from './components/ui/IconButton';
import * as esbuild from 'esbuild-wasm';
import { loadPackageTypings } from './lib/typings';
import { decodeSharePayload, encodeSharePayload } from './lib/shareCodec';
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard';
import { formatAllFiles, loadPrettier } from './lib/formatter';

// ── Auto-detect imports (AST based) ───────────────────────────────────────────
function detectImports(code: string): string[] {
  const ts = (window as any).ts;
  if (!ts) {
    // Fallback to regex if TS is not loaded yet
    const noComments = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const imports = new Set<string>();
    const regex = /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(noComments)) !== null) {
      const pkg = match[1] || match[2] || match[3];
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/') && !pkg.startsWith('http')) {
        const parts = pkg.split('/');
        const name = pkg.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
        if (name) imports.add(name);
      }
    }
    return Array.from(imports);
  }

  // Use AST for robust parsing
  const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.Latest, true);
  const imports = new Set<string>();

  function visit(node: any) {
    if (ts.isImportDeclaration(node)) {
      const text = node.moduleSpecifier?.text;
      if (text && !text.startsWith('.') && !text.startsWith('/') && !text.startsWith('http')) {
        const parts = text.split('/');
        const name = text.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
        if (name) imports.add(name);
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const text = arg.text;
        if (text && !text.startsWith('.') && !text.startsWith('/') && !text.startsWith('http')) {
          const parts = text.split('/');
          const name = text.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
          if (name) imports.add(name);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Array.from(imports);
}

// ── esbuild-wasm loader ───────────────────────────────────────────────────────
let esbuildReady = false;
let esbuildPromise: Promise<void> | null = null;

async function loadEsbuild() {
  if (esbuildReady) return;
  if (!esbuildPromise) {
    esbuildPromise = (async () => {
      try {
        if (!esbuild || typeof esbuild.initialize !== 'function') {
          throw new Error('esbuild-wasm not properly loaded');
        }
        await esbuild.initialize({
          wasmURL: 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.23.1/esbuild.wasm',
          worker: true,
        });
        esbuildReady = true;
      } catch (e) {
        esbuildPromise = null;
        throw e;
      }
    })();
  }
  return esbuildPromise;
}

// ── TypeScript loader (diagnostics only) ──────────────────────────────────────
let tsPromise: Promise<void> | null = null;
function loadTS(): Promise<void> {
  if (tsPromise) return tsPromise;
  tsPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).ts) { resolve(); return; }
    const existing = document.querySelector('#ts-cdn');
    if (existing) {
      existing.addEventListener('load',  () => resolve());
      existing.addEventListener('error', () => reject(new Error('TypeScript compiler failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.id  = 'ts-cdn';
    s.src = 'https://cdn.jsdelivr.net/npm/typescript@5.4.5/lib/typescript.js';
    s.onload  = () => resolve();
    s.onerror = () => { tsPromise = null; reject(new Error('Failed to load TypeScript compiler')); };
    document.head.appendChild(s);
  });
  return tsPromise;
}

// ── Compiler ─────────────────────────────────────────────────────────────────
async function compile(tsCode: string): Promise<{ js: string; dts: string }> {
  await loadEsbuild();

  if (!esbuildReady || typeof esbuild.build !== 'function') {
    throw new Error('esbuild not properly initialized');
  }

  const httpPlugin: esbuild.Plugin = {
    name: 'http-resolve',
    setup(build) {
      build.onResolve({ filter: /^https?:\/\// }, (args) => ({
        path: args.path,
        namespace: 'http-url',
      }));

      build.onResolve({ filter: /^\//, namespace: 'http-url' }, (args) => {
        const base = new URL(args.importer).origin;
        return { path: new URL(args.path, base).toString(), namespace: 'http-url' };
      });

      build.onResolve({ filter: /^\./ }, (args) => {
        const base = args.resolveDir || 'https://esm.sh/';
        const resolved = new URL(args.path, base).toString();
        return { path: resolved, namespace: 'http-url' };
      });

      build.onResolve({ filter: /^[^./].*/ }, (args) => {
        const fallback = `https://esm.sh/${args.path}`;
        return { path: fallback, namespace: 'http-url' };
      });

      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
        const res = await fetch(args.path);
        if (!res.ok) throw new Error(`Failed to fetch ${args.path}`);
        const contents = await res.text();
        const ext = args.path.split('?')[0].split('.').pop() || 'js';
        let loader: esbuild.Loader = 'js';
        if (ext === 'ts') loader = 'ts';
        else if (ext === 'tsx') loader = 'tsx';
        else if (ext === 'jsx') loader = 'jsx';
        else if (ext === 'css') loader = 'css';
        const resolveDir = new URL('.', args.path).toString();
        return { contents, loader, resolveDir };
      });
    },
  };

  try {
    const jsBuild = await esbuild.build({
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      write: false,
      sourcemap: false,
      stdin: {
        contents: tsCode,
        loader: 'ts',
        sourcefile: 'main.ts',
        resolveDir: '/',
      },
      plugins: [httpPlugin],
    });

    const js = jsBuild.outputFiles?.[0]?.text || '';
    const dts = generateDeclarations(tsCode);
    return { js, dts };
  } catch (e) {
    console.error('esbuild build error:', e);
    throw new Error(`Build failed: ${(e as Error).message}`);
  }
}

function generateDeclarations(code: string): string {
  const lines = code.split('\n');
  const dtsLines: string[] = [];
  let inBlockComment = false;
  let pendingJsDoc: string[] = [];
  let braceDepth = 0;
  let capturing = false;
  let captureLines: string[] = [];
  let captureType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inBlockComment) {
      if (capturing) captureLines.push(line);
      else pendingJsDoc.push(line);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      if (capturing) captureLines.push(line);
      else pendingJsDoc = [line];
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    if (capturing) {
      captureLines.push(line);
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        if (captureType === 'class') {
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(...extractClassDeclaration(captureLines));
        } else {
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(...captureLines);
        }
        dtsLines.push('');
        capturing = false;
        captureLines = [];
        pendingJsDoc = [];
        captureType = '';
      }
      continue;
    }

    if (trimmed.startsWith('//')) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) continue;

    if (/^(export\s+)?interface\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'interface';
      captureLines = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && line.includes('}')) {
        dtsLines.push(...pendingJsDoc, line, '');
        capturing = false;
        captureLines = [];
        pendingJsDoc = [];
      }
      continue;
    }

    if (/^(export\s+)?type\s+\w+/.test(trimmed)) {
      dtsLines.push(...pendingJsDoc);
      if (!trimmed.includes(';') && trimmed.includes('{')) {
        capturing = true;
        captureType = 'type';
        captureLines = [line];
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      } else {
        dtsLines.push(trimmed.startsWith('export') ? line : `export ${line}`);
        dtsLines.push('');
      }
      pendingJsDoc = [];
      continue;
    }

    if (/^(export\s+)?(const\s+)?enum\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'enum';
      const declLine = trimmed.startsWith('export') ? line : `export ${line}`;
      captureLines = [declLine.replace(/^(export\s+)?(const\s+)?enum/, 'declare enum')];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    if (/^(export\s+)?(abstract\s+)?class\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'class';
      captureLines = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    const fnMatch = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?/);
    if (fnMatch) {
      const [, exp, isAsync, name, generics, params, returnType] = fnMatch;
      const asyncPrefix = isAsync ? 'async ' : '';
      const gen = generics || '';
      const ret = returnType?.trim() || (isAsync ? 'Promise<void>' : 'void');
      const prefix = exp ? 'export declare' : 'declare';
      dtsLines.push(...pendingJsDoc);
      dtsLines.push(`${prefix} ${asyncPrefix}function ${name}${gen}(${params}): ${ret};`);
      dtsLines.push('');
      pendingJsDoc = [];
      if (trimmed.includes('{')) {
        let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          depth += (lines[i].match(/\{/g) || []).length;
          depth -= (lines[i].match(/\}/g) || []).length;
        }
      }
      continue;
    }

    const constMatch = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*(?::\s*([^=]+?))?\s*=/);
    if (constMatch) {
      const [, exp, _kind, name, explicitType] = constMatch;
      const prefix = exp ? 'export declare' : 'declare';

      if (explicitType) {
        dtsLines.push(...pendingJsDoc);
        dtsLines.push(`${prefix} const ${name}: ${explicitType.trim()};`);
        dtsLines.push('');
      } else {
        const valueMatch = trimmed.match(/=\s*(.+?)(?:;|$)/);
        if (valueMatch) {
          const val = valueMatch[1].trim();
          let inferredType = 'unknown';
          if (/^["'`]/.test(val)) inferredType = 'string';
          else if (/^\d/.test(val)) inferredType = 'number';
          else if (val === 'true' || val === 'false') inferredType = 'boolean';
          else if (val.startsWith('[')) inferredType = 'unknown[]';
          else if (val.startsWith('{')) inferredType = 'Record<string, unknown>';
          else if (val.startsWith('new ')) {
            const className = val.match(/new\s+(\w+)/)?.[1];
            inferredType = className || 'unknown';
          }
          if (val.includes('=>') || val.startsWith('function') || val.startsWith('async')) {
            const arrowMatch = val.match(/(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+?))?\s*=>/);
            if (arrowMatch) {
              const aParams = arrowMatch[1];
              const aRet = arrowMatch[2]?.trim() || 'void';
              const isAsync = val.startsWith('async');
              const retType = isAsync && !aRet.startsWith('Promise') ? `Promise<${aRet}>` : aRet;
              dtsLines.push(...pendingJsDoc);
              dtsLines.push(`${prefix} const ${name}: (${aParams}) => ${retType};`);
              dtsLines.push('');
              pendingJsDoc = [];
              if (trimmed.includes('{')) {
                let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                while (depth > 0 && i + 1 < lines.length) {
                  i++;
                  depth += (lines[i].match(/\{/g) || []).length;
                  depth -= (lines[i].match(/\}/g) || []).length;
                }
              }
              continue;
            }
          }
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(`${prefix} const ${name}: ${inferredType};`);
          dtsLines.push('');
        }
      }
      pendingJsDoc = [];
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          depth += (lines[i].match(/\{/g) || []).length;
          depth -= (lines[i].match(/\}/g) || []).length;
        }
      }
      continue;
    }

    pendingJsDoc = [];
  }

  return dtsLines.join('\n').trim() || '// No exported declarations found';
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
  const [dtsCode, setDtsCode] = useState('// .d.ts declarations will appear here');
  const [activeTab, setActiveTab] = useState<'ts' | 'js' | 'dts'>('ts');

  const [compilerStatus, setCompilerStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [jsDirty, setJsDirty] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>({});

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

  // Console capture (Global)
  const addMessage = useCallback((type: ConsoleMessage['type'], args: unknown[]) => {
    // Prevent React infinite loop warnings from causing actual infinite loops in our state
    if (type === 'error' && args.some(a => typeof a === 'string' && a.includes('Maximum update depth exceeded'))) {
      return;
    }
    const formatted = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    });
    // Limit to 500 messages to prevent O(N^2) memory/render bloat
    setMessages(prev => [...prev, { type, args: formatted, ts: Date.now() }].slice(-500));
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

  // Auto-detect imports
  useEffect(() => {
    const timer = setTimeout(() => {
      const detected = detectImports(tsCode);
      setInstalledPackages(detected.map(name => ({
        name,
        version: 'latest',
        cdn: 'esm.sh',
        url: `https://esm.sh/${name}`
      })));
    }, 500);
    return () => clearTimeout(timer);
  }, [tsCode]);

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

  useEffect(() => {
    Promise.all([loadEsbuild(), loadTS()])
      .then(() => setCompilerStatus('ready'))
      .catch(() => setCompilerStatus('error'));
  }, []);

  useEffect(() => {
    let active = true;
    loadPackageTypings(installedPackages).then((libs) => {
      if (active) setPackageTypings(libs);
    });
    return () => { active = false; };
  }, [installedPackages]);

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

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {/* silent */});
    }
  }, [compilerStatus]);

  const doRun = useCallback(async (skipDirtyCheck = false) => {
    if (!skipDirtyCheck && jsDirty) { setShowModal(true); return; }
    setShowModal(false);
    setIsRunning(true);
    setMessages([]);

    let compiled = { js: '', dts: '' };
    try {
      compiled = await compile(tsCode);
    } catch (e) {
      setMessages([{ type: 'error', args: [`Compilation error: ${(e as Error).message}`], ts: Date.now() }]);
      setIsRunning(false);
      return;
    }

    setJsCode(compiled.js);
    setDtsCode(compiled.dts);
    setJsDirty(false);

    try {
      const blob = new Blob([compiled.js], { type: 'application/javascript' });
      const url  = URL.createObjectURL(blob);
      await import(/* @vite-ignore */ url);
      URL.revokeObjectURL(url);
    } catch (e) {
      addMessage('error', [`Runtime error: ${(e as Error).message}`]);
    } finally {
      setIsRunning(false);
    }
  }, [tsCode, jsDirty, addMessage]);

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

  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setConsoleOpen(o => !o);
  }, []);

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
            fontFamily: 'monospace',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {/* Theme toggle */}
          <IconButton
            onClick={() => setThemeMode(m => m === 'mocha' ? 'latte' : 'mocha')}
            title={themeMode === 'mocha' ? 'Switch to Latte (light)' : 'Switch to Mocha (dark)'}
            theme={t}
            size="sm"
            variant="surface"
            style={{ minWidth: 22, height: 22, borderRadius: 4, padding: '2px 4px', fontSize: 10 }}
          >
            {themeMode === 'mocha' ? '☀️' : '🌙'}
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
              fontSize: 10,
            }}
          >
            {copied ? '✓' : '⧉'}
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
              fontSize: 10,
            }}
          >
            🗑
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
              fontSize: 10,
              color: formatSuccess ? t.green : formatting ? t.overlay0 : t.mauve,
              borderColor: formatSuccess ? t.green : t.surface1,
              background: formatSuccess ? `${t.green}15` : formatting ? t.surface0 : `${t.mauve}12`,
              transition: 'all 160ms',
            }}
          >
            {formatting ? '⏳' : formatSuccess ? '✓' : '⌥'}
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
              fontFamily:    'monospace',
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
              fontSize: 9,
              lineHeight: 1,
            }}>
              {isRunning
                ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                : '▶'}
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
              fontSize: 10,
              color: shareSuccess ? t.green : t.blue,
              borderColor: shareSuccess ? t.green : t.surface1,
              background: shareSuccess ? `${t.green}15` : t.surface0,
            }}
          >
            {sharing ? '⏳' : shareSuccess ? '✓' : '🔗'}
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
        <span style={{ fontSize: 10, color: statusColor, fontFamily: 'monospace', letterSpacing: '0.04em' }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 10, color: t.overlay0, fontFamily: 'monospace' }}>
          {activeTab === 'ts' ? 'TypeScript' : activeTab === 'js' ? 'JavaScript' : 'Declarations'}
          {activeTab === 'js' && jsDirty && (
            <span style={{ marginLeft: 6, color: t.peach }}>● modified</span>
          )}
        </span>
        {!compactForKeyboard && (
          <span style={{ fontSize: 10, color: t.overlay0, fontFamily: 'monospace' }}>
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
          onClear={() => setMessages([])}
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
      `}</style>
    </div>
  );
}
