import { useEffect, useState, useRef } from 'react';

export interface TSDiagnostic {
  start: number;
  length: number;
  message: string;
  category: 'error' | 'warning';
}

let ls: any = null;
const files: any = {};

export function useTSDiagnostics(code: string, isTypeScript: boolean) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([]);
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      const ts = (window as any).ts;
      if (!ts) return; // Not loaded yet

      if (!ls) {
        const compilerOptions = {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          suppressExcessPropertyErrors: true,
          noImplicitAny: false,
        };

        const host = {
          getScriptFileNames: () => ['main.ts'],
          getScriptVersion: () => files['main.ts']?.version.toString() || "1",
          getScriptSnapshot: (fileName: string) => {
            if (fileName !== 'main.ts') return undefined;
            return ts.ScriptSnapshot.fromString(files['main.ts']?.content || "");
          },
          getCurrentDirectory: () => "/",
          getCompilationSettings: () => compilerOptions,
          getDefaultLibFileName: () => "lib.d.ts",
          fileExists: (fileName: string) => fileName === 'main.ts',
          readFile: (fileName: string) => fileName === 'main.ts' ? files['main.ts']?.content : undefined,
          readDirectory: () => [],
          directoryExists: () => true,
          getDirectories: () => []
        };

        ls = ts.createLanguageService(host, ts.createDocumentRegistry());
      }

      files['main.ts'] = {
        version: (files['main.ts']?.version || 0) + 1,
        content: code
      };

      try {
        const syntactic = ls.getSyntacticDiagnostics('main.ts');
        const semantic = ls.getSemanticDiagnostics('main.ts');

        const all = [...syntactic, ...semantic];

        // Filter out missing lib/global errors (since we don't load lib.d.ts)
        const ignoredCodes = new Set([
          2304, // Cannot find name
          2584, // Cannot find name 'console'
          2318, // Cannot find global type
          2583, // Cannot find name 'Set'
          2593, // Cannot find name 'Map'
          2339, // Property does not exist
          2307, // Cannot find module
          2792, // Cannot find module
          1128, // Declaration expected
          2552, // Cannot find name
          2308, // module
        ]);

        const filtered = all.filter((d: any) => !ignoredCodes.has(d.code));

        const formatted: TSDiagnostic[] = filtered.map((d: any) => ({
          start: d.start || 0,
          length: d.length || 0,
          message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
          category: (d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error') as 'error' | 'warning'
        }));

        setDiagnostics(formatted);
      } catch (e) {
        console.error("Diagnostic error", e);
      }
    }, 400); // debounce compiling diagnostics

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [code, isTypeScript]);

  return diagnostics;
}
