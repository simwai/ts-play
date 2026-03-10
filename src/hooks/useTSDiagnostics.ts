import { useEffect, useState, useRef } from 'react';
import { workerClient } from '../lib/workerClient';

export interface TSDiagnostic {
  start:     number;
  length:    number;
  message:   string;
  category:  'error' | 'warning';
  line:      number;
  character: number;
}

const EMPTY_LIBS = {};

export function useTSDiagnostics(
  code: string,
  isTypeScript: boolean,
  extraLibs: Record<string, string> = EMPTY_LIBS
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([]);
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      if (code.length > 20000) return;

      try {
        await workerClient.updateFile('main.ts', code);
        await workerClient.updateExtraLibs(extraLibs);
        const diags = await workerClient.getDiagnostics();
        setDiagnostics(diags);
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
