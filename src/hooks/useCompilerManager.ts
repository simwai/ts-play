import { useState, useEffect, useCallback, useRef } from 'react';
import { workerClient } from '../lib/workerClient';
import { loadPrettier } from '../lib/formatter';
import { webContainerService } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';
import type { WebContainerProcess } from '@webcontainer/api';

/**
 * useCompilerManager coordinates with WebContainerService to execute code.
 * It leverages the high-level Service APIs to ensure build integrity and clean output.
 */
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
        console.error('Compiler worker initialization failed:', error);
        setCompilerStatus('error');
      });
  }, []);

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {});
    }
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

      await webContainerService.enqueue(async (instance) => {
        // Step 1: Ensure latest code is on disk
        await webContainerService.writeFile('index.ts', codeToCompile);

        // Step 2: Wait for any pending user installs (lodash-es etc)
        await pendingInstalls;

        // Step 3: BUILD INTEGRITY GATE
        // Wait until the background compiler has processed the current version
        addMessage('info', ['Waiting for background compilation...']);
        await webContainerService.waitForBuild();

        addMessage('info', ['Executing pre-compiled index.js...']);

        // Step 4: Managed execution with clean output buffering
        const { process, exit } = await webContainerService.spawnManaged('node', ['dist/index.js'], {
          onLog: (line) => addMessage('log', [line]),
          silent: true // Code logs are routed through the callback
        });

        currentProcess.current = process;

        // Sync previews via worker for UI responsiveness
        workerClient.compile(codeToCompile).then(res => {
          setOutputFiles(res);
          onSuccess(res.js, res.dts);
        });

        timeoutRef.current = setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill();
            currentProcess.current = null;
          }
          addMessage('error', ['Execution timed out after 60s.']);
          setIsRunning(false);
        }, 60000);

        const exitCode = await exit;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        currentProcess.current = null;
        if (exitCode !== 0) {
          addMessage('error', [`Process exited with code ${exitCode}`]);
        }
      });
    } catch (error) {
      const msg = (error as Error).message || String(error);
      addMessage('error', [msg]);
      onError(error as Error);
    } finally {
      setIsRunning(false);
    }
  }, [addMessage, isRunning]);

  return { compilerStatus, isRunning, runCode, stopCode, outputFiles, setOutputFiles };
}
