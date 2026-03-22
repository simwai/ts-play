import { useState, useEffect, useCallback, useRef } from 'react';
import { workerClient } from '../lib/workerClient';
import { loadPrettier } from '../lib/formatter';
import { runCommand, getWebContainer, getEnvReady } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';
import type { WebContainerProcess } from '@webcontainer/api';

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
) {
  const [compilerStatus, setCompilerStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isRunning, setIsRunning] = useState(false);
  const currentProcess = useRef<WebContainerProcess | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(tsCode);
  const [outputFiles, setOutputFiles] = useState<{ js: string; dts: string }>({ js: '', dts: '' });

  useEffect(() => {
    codeRef.current = tsCode;
  }, [tsCode]);

  useEffect(() => {
    workerClient.init()
      .then(() => setCompilerStatus('ready'))
      .catch((error) => {
        console.error('Worker init failed:', error);
        setCompilerStatus('error');
      });
  }, []);

  useEffect(() => {
    if (compilerStatus === 'ready') loadPrettier().catch(() => {});
  }, [compilerStatus]);

  const stopCode = useCallback(() => {
    if (currentProcess.current) {
      currentProcess.current.kill();
      currentProcess.current = null;
      addMessage('info', ['Execution stopped by user.']);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsRunning(false);
  }, [addMessage]);

  const runCode = useCallback(async (
    pendingInstalls: Promise<void>,
    onSuccess: (js: string, dts: string) => void,
    onError: (error: Error) => void,
  ) => {
    if (isRunning) return;
    setIsRunning(true);

    try {
      const codeToCompile = codeRef.current;
      const wc = await getWebContainer();

      // Write code and wait for environment
      await wc.fs.writeFile('index.ts', codeToCompile);
      await getEnvReady();
      await pendingInstalls;

      addMessage('info', ['Executing via vite-node...']);

      const { exit, process } = await runCommand('npx', ['vite-node', 'index.ts'], (out) => {
        if (out && typeof out === 'string') {
          out.split('\\n').filter(Boolean).forEach(line => addMessage('log', [line.trim()]));
        }
      });

      currentProcess.current = process;

      // Separate process to extract output files using esbuild-wasm (or similar via worker)
      // Since we want JS/DTS for the UI tabs, we still use the worker but rely on vite-node for real execution
      workerClient.compile(codeToCompile).then(res => {
        setOutputFiles(res);
        onSuccess(res.js, res.dts);
      });

      timeoutRef.current = setTimeout(() => {
        if (currentProcess.current) {
          currentProcess.current.kill();
          currentProcess.current = null;
        }
        addMessage('error', ['Execution timed out after 5 minutes.']);
        setIsRunning(false);
      }, 300000);

      const exitCode = await exit;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      currentProcess.current = null;
      if (exitCode !== 0) addMessage('error', [`Process exited with code ${exitCode}`]);
    } catch (error) {
      onError(error as Error);
    } finally {
      setIsRunning(false);
    }
  }, [addMessage, isRunning]);

  return { compilerStatus, isRunning, runCode, stopCode, outputFiles };
}
