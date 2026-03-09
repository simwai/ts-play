import { useEffect, useState, useRef } from 'react';

export interface TSDiagnostic {
  start:     number;
  length:    number;
  message:   string;
  category:  'error' | 'warning';
  line:      number;
  character: number;
}

// Module-level singletons
let ls: any = null;
let lsVersion = '';
let libsSignature = '';
const files: Record<string, { version: number; content: string }> = {};
const libFiles: Record<string, { version: number; content: string }> = {};
let libsLoaded = false;
let libsLoadingPromise: Promise<void> | null = null;

export function getLanguageService() {
  return ls;
}

export function updateTSFile(fileName: string, content: string) {
  const normalized = normalizeVirtualPath(fileName);
  if (files[normalized]?.content !== content) {
    files[normalized] = {
      version: (files[normalized]?.version || 0) + 1,
      content
    };
  }
}

function normalizeVirtualPath(fileName: string): string {
  return fileName.replace(/\\/g, '/').replace(/^\/+/, '');
}

const TS_VERSION = '5.4.5';
const REQUIRED_LIBS = [
  'lib.es5.d.ts',
  'lib.es2015.d.ts',
  'lib.es2015.core.d.ts',
  'lib.es2015.collection.d.ts',
  'lib.es2015.generator.d.ts',
  'lib.es2015.iterable.d.ts',
  'lib.es2015.promise.d.ts',
  'lib.es2015.proxy.d.ts',
  'lib.es2015.reflect.d.ts',
  'lib.es2015.symbol.d.ts',
  'lib.es2015.symbol.wellknown.d.ts',
  'lib.es2016.d.ts',
  'lib.es2016.array.include.d.ts',
  'lib.es2017.d.ts',
  'lib.es2017.date.d.ts',
  'lib.es2017.object.d.ts',
  'lib.es2017.sharedmemory.d.ts',
  'lib.es2017.string.d.ts',
  'lib.es2017.intl.d.ts',
  'lib.es2017.typedarrays.d.ts',
  'lib.es2018.d.ts',
  'lib.es2018.asyncgenerator.d.ts',
  'lib.es2018.asynciterable.d.ts',
  'lib.es2018.intl.d.ts',
  'lib.es2018.promise.d.ts',
  'lib.es2018.regexp.d.ts',
  'lib.es2019.d.ts',
  'lib.es2019.array.d.ts',
  'lib.es2019.object.d.ts',
  'lib.es2019.string.d.ts',
  'lib.es2019.symbol.d.ts',
  'lib.es2019.intl.d.ts',
  'lib.es2020.d.ts',
  'lib.es2020.bigint.d.ts',
  'lib.es2020.date.d.ts',
  'lib.es2020.promise.d.ts',
  'lib.es2020.sharedmemory.d.ts',
  'lib.es2020.string.d.ts',
  'lib.es2020.symbol.wellknown.d.ts',
  'lib.es2020.intl.d.ts',
  'lib.es2020.number.d.ts',
  'lib.dom.d.ts',
  'lib.dom.iterable.d.ts',
];

async function ensureRequiredLibsLoaded() {
  if (libsLoaded) return;
  if (libsLoadingPromise) return libsLoadingPromise;

  libsLoadingPromise = (async () => {
    try {
      const base = `https://cdn.jsdelivr.net/npm/typescript@${TS_VERSION}/lib/`;
      const entries = await Promise.all(
        REQUIRED_LIBS.map(async (fileName) => {
          const text = await fetch(base + fileName).then((r) => {
            if (!r.ok) throw new Error(`Failed to load ${fileName}`);
            return r.text();
          });
          return [fileName, text] as const;
        })
      );
      for (const [fileName, content] of entries) {
        libFiles[fileName] = { version: 1, content };
      }
      libsLoaded = true;
    } finally {
      libsLoadingPromise = null;
    }
  })();

  return libsLoadingPromise;
}

export function useTSDiagnostics(
  code: string,
  isTypeScript: boolean,
  extraLibs: Record<string, string> = {}
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([]);
      return;
    }

    updateTSFile('main.ts', code);

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      const ts = (window as any).ts;
      if (!ts) return;

      if (code.length > 20000) return;

      try {
        const currentVersion = ts.version ?? '';
        const currentLibSignature = Object.keys(extraLibs).sort().join('|');
        if (!ls || lsVersion !== currentVersion || libsSignature !== currentLibSignature) {
          ls = null;
          lsVersion = currentVersion;
          libsSignature = currentLibSignature;
          libsLoaded = false;
        }

        await ensureRequiredLibsLoaded();

        Object.entries(extraLibs).forEach(([name, content]) => {
          if (!libFiles[name] || libFiles[name].content !== content) {
            libFiles[name] = { version: (libFiles[name]?.version || 0) + 1, content };
          }
        });

        if (!ls) {
          if (!ts.createLanguageService || !ts.ScriptSnapshot || !ts.createDocumentRegistry) {
            console.warn('TypeScript APIs not fully available');
            return;
          }

          const compilerOptions = {
            target: ts.ScriptTarget?.ES2020 ?? 7,
            module: ts.ModuleKind?.ESNext ?? 6,
            moduleResolution: ts.ModuleResolutionKind?.NodeJs ?? 2,
            lib: [
              'lib.es5.d.ts',
              'lib.es2015.d.ts',
              'lib.es2016.d.ts',
              'lib.es2017.d.ts',
              'lib.es2018.d.ts',
              'lib.es2019.d.ts',
              'lib.es2020.d.ts',
              'lib.dom.d.ts',
              'lib.dom.iterable.d.ts',
            ],
            esModuleInterop: true,
            strict: true,
            skipLibCheck: true,
            suppressExcessPropertyErrors: true,
            noImplicitAny: false,
            typeRoots: [],
          };

          const host = {
            getScriptFileNames: () => [
              '/main.ts',
              ...Object.keys(libFiles).map((name) => `/${name}`),
              ...Object.keys(extraLibs),
            ],
            getScriptVersion:   (fileName: string) => {
              const normalized = normalizeVirtualPath(fileName);
              if (normalized === 'main.ts') return String(files['main.ts']?.version ?? 0);
              if (libFiles[normalized]) return String(libFiles[normalized].version);
              if (extraLibs[fileName]) return String(extraLibs[fileName].length);
              if (extraLibs[normalized]) return String(extraLibs[normalized].length);
              return '0';
            },
            getScriptSnapshot: (fileName: string) => {
              try {
                const normalized = normalizeVirtualPath(fileName);
                if (!ts.ScriptSnapshot?.fromString) return undefined;
                if (normalized === 'main.ts') {
                  return ts.ScriptSnapshot.fromString(files['main.ts']?.content ?? '');
                }
                if (libFiles[normalized]) return ts.ScriptSnapshot.fromString(libFiles[normalized].content);
                if (extraLibs[fileName]) return ts.ScriptSnapshot.fromString(extraLibs[fileName]);
                if (extraLibs[normalized]) return ts.ScriptSnapshot.fromString(extraLibs[normalized]);
              } catch (e) {
                console.error('ScriptSnapshot error:', e);
              }
              return undefined;
            },
            getCurrentDirectory: () => "/",
            getCompilationSettings: () => compilerOptions,
            getDefaultLibFileName: () => '/lib.es2020.d.ts',
            fileExists: (fileName: string) => {
              const normalized = normalizeVirtualPath(fileName);
              if (normalized === 'main.ts') return true;
              if (libFiles[normalized]) return true;
              if (extraLibs[fileName]) return true;
              if (extraLibs[normalized]) return true;
              return false;
            },
            readFile: (fileName: string) => {
              const normalized = normalizeVirtualPath(fileName);
              if (normalized === 'main.ts') return files['main.ts']?.content;
              if (libFiles[normalized]) return libFiles[normalized].content;
              if (extraLibs[fileName]) return extraLibs[fileName];
              if (extraLibs[normalized]) return extraLibs[normalized];
              return undefined;
            },
            readDirectory: () => [],
            directoryExists: () => true,
            getDirectories: () => [],
            useCaseSensitiveFileNames: () => true,
            getCanonicalFileName: (fileName: string) => fileName,
            getNewLine: () => "\n"
          };

          ls = ts.createLanguageService(host, ts.createDocumentRegistry());
        }

        try {
          if (!ls.getSyntacticDiagnostics || !ls.getSemanticDiagnostics) {
            console.warn('Language service methods not available');
            return;
          }
          const syntactic = ls.getSyntacticDiagnostics('main.ts') || [];
          const semantic = ls.getSemanticDiagnostics('main.ts') || [];

          const all = [...syntactic, ...semantic];

          const ignoredCodes = new Set([
            1128, 
            2308, 
          ]);

          const filtered = all.filter((d: any) => !ignoredCodes.has(d.code));

          // O(N) pre-calculation of line starts for O(log N) lookups
          const lineStarts = [0];
          for (let i = 0; i < code.length; i++) {
            if (code[i] === '\n') lineStarts.push(i + 1);
          }

          const formatted: TSDiagnostic[] = filtered.map((d: any) => {
            const start = d.start || 0;
            
            // Binary search for line number
            let l = 0, r = lineStarts.length - 1;
            while (l <= r) {
              const m = (l + r) >> 1;
              if (lineStarts[m] <= start) l = m + 1;
              else r = m - 1;
            }
            const line = r;
            const character = start - lineStarts[line];
            
            let message = 'Unknown error';
            try {
              message = ts.flattenDiagnosticMessageText 
                ? ts.flattenDiagnosticMessageText(d.messageText, "\n")
                : String(d.messageText);
            } catch (e) {
              message = String(d.messageText);
            }
            
            const category = (d.category === ts.DiagnosticCategory?.Warning ? 'warning' : 'error') as 'error' | 'warning';
            
            return {
              start,
              length: d.length || 0,
              message,
              category,
              line,
              character,
            };
          });

          setDiagnostics(formatted);
        } catch (e) {
          console.error("Diagnostic error", e);
        }
      } catch (e) {
        console.error("Diagnostic pipeline error", e);
      }
    }, 250);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [code, isTypeScript, extraLibs]);

  return diagnostics;
}
