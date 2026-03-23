import { useState, useEffect, useCallback, useRef } from 'react';
import { workerClient } from '../lib/workerClient';
import { loadPrettier } from '../lib/formatter';
import { webContainerService } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';
import type { WebContainerProcess } from '@webcontainer/api';

/**
 * Clean ANSI codes and control characters.
 * Very conservative.
 */
function cleanANSI(text: string): string {
  if (!text) return '';
  const parts = text.split('\r');
  let result = parts[parts.length - 1];

  // Only strip the most common CSI sequences that interfere with display
  // ESC [ ... m (color), ESC [ ... K (clear line), etc.
  result = result.replace(/\u001B\[[\d;]*[a-zA-Z]/g, '');

  // Keep printable characters, tabs, and newlines
  // Range \x20-\x7E (ASCII printables)
  // Plus \x09 (tab), \x0A (newline), \x0D (carriage return)
  result = result.replace(/[^\x20-\x7E\x09\x0A\x0D]/g, '');

  return result;
}

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
        // Write latest code and wait for installs
        await instance.fs.writeFile('index.ts', codeToCompile);
        await pendingInstalls;

        addMessage('info', ['Executing pre-compiled index.js...']);

        try {
          const content = await instance.fs.readFile('dist/index.js', 'utf8');
          if (!content.trim()) throw new Error('Artifact is empty.');
        } catch (e) {
          throw new Error('Build artifact dist/index.js not found or empty. Please wait for the compiler to finish.');
        }

        const process = await instance.spawn('node', ['dist/index.js']);
        currentProcess.current = process;

        let buffer = '';
        process.output.pipeTo(
          new WritableStream({
            write(chunk) {
              if (chunk && typeof chunk === 'string') {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const sanitized = cleanANSI(line);
                  if (sanitized.trim().length > 0) {
                    addMessage('log', [sanitized]);
                  }
                }
              }
            },
            close() {
              if (buffer.trim()) {
                const sanitized = cleanANSI(buffer);
                if (sanitized.trim().length > 0) {
                  addMessage('log', [sanitized]);
                }
              }
            }
          })
        );

        // Update previews via worker for UI responsiveness
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
      const msg = (error as Error).message || String(error);
      addMessage('error', [msg]);
      onError(error as Error);
    } finally {
      setIsRunning(false);
    }
  }, [addMessage, isRunning]);

  return { compilerStatus, isRunning, runCode, stopCode, outputFiles, setOutputFiles };
}
