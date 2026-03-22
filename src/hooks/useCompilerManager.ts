import { useState, useEffect, useCallback, useRef } from 'react';
import { workerClient } from '../lib/workerClient';
import { loadPrettier } from '../lib/formatter';
import { webContainerService } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';
import type { WebContainerProcess } from '@webcontainer/api';

/**
 * useCompilerManager manages the compilation and execution UI state.
 * It coordinates with the WebContainerService to run the user's code
 * and provides status information to the UI.
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

  /**
   * Initialize the local worker for background tasks like syntax highlighting
   * and quick JS/DTS previews.
   */
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

  /**
   * Stops any currently running process in the WebContainer.
   */
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

  /**
   * Executes the code using tsx (formerly vite-node) inside the WebContainer.
   * Leverages the centralized queue to ensure it waits for installs and ready state.
   */
  const runCode = useCallback(async (
    pendingInstalls: Promise<void>,
    onSuccess: (js: string, dts: string) => void,
    onError: (error: Error) => void,
  ) => {
    if (isRunning) return;
    setIsRunning(true);

    try {
      const codeToCompile = codeRef.current;

      // Use the centralized queue
      await webContainerService.enqueue(async (instance) => {
        // Ensure the latest code is written to the virtual filesystem
        await instance.fs.writeFile('index.ts', codeToCompile);

        // Wait for any pending user package installations (which are also queued)
        await pendingInstalls;

        addMessage('info', ['Executing via tsx...']);

        // Replacing vite-node with tsx
        const process = await instance.spawn('npx', ['tsx', 'index.ts']);
        currentProcess.current = process;

        process.output.pipeTo(
          new WritableStream({
            write(out) {
              if (out && typeof out === 'string') {
                // Stream output to the application console, filter out excessive whitespace
                const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
                lines.forEach(line => addMessage('log', [line]));
              }
            },
          })
        );

        // Generate immediate previews for the JS and DTS tabs using the local worker
        workerClient.compile(codeToCompile).then(res => {
          setOutputFiles(res);
          onSuccess(res.js, res.dts);
        });

        // Safety timeout: Execution is capped at 5 minutes
        timeoutRef.current = setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill();
            currentProcess.current = null;
          }
          addMessage('error', ['Execution timed out after 5 minutes.']);
          setIsRunning(false);
        }, 300000);

        const exitCode = await process.exit;
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
      onError(error as Error);
    } finally {
      setIsRunning(false);
    }
  }, [addMessage, isRunning]);

  return { compilerStatus, isRunning, runCode, stopCode, outputFiles };
}
