import { useEffect, useRef, useCallback, useState } from 'react';
import { webContainerService, SYSTEM_DEPS } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';

/**
 * useWebContainer manages the entire lifecycle of the browser-based environment.
 * It is responsible for the initial boot, writing system configuration files,
 * performing the first npm install, and keeping the environment in sync with the UI.
 * Now it also manages a background 'tsc --watch' process to reactively emit JS/DTS.
 */
export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  onArtifactsChange: (js: string, dts: string) => void
) {
  const isInitialSync = useRef(true);
  const [externalTypings, setExternalTypings] = useState<Record<string, string>>({});

  /**
   * Scans node_modules for .d.ts files and synchronizes them to Monaco.
   */
  const syncTypes = useCallback(async () => {
    try {
      const types = await webContainerService.readDirRecursive('node_modules', (path) => path.endsWith('.d.ts'));
      setExternalTypings(types);
    } catch (err) {
      console.error('Failed to sync types:', err);
    }
  }, []);

  /**
   * Watch the 'dist' directory for changes to automatically sync emitted JS and DTS.
   */
  const watchDist = useCallback(async () => {
    const wc = await webContainerService.getInstance();

    // Initial sync
    const sync = async () => {
      try {
        const js = await wc.fs.readFile('dist/index.js', 'utf8').catch(() => '');
        const dts = await wc.fs.readFile('dist/index.d.ts', 'utf8').catch(() => '');
        if (js || dts) onArtifactsChange(js, dts);
      } catch {}
    };

    wc.fs.watch('dist', { recursive: true }, () => {
      sync();
    });

    sync(); // Initial
  }, [onArtifactsChange]);

  /**
   * The core initialization loop.
   */
  useEffect(() => {
    if (!isInitialSync.current) return;
    isInitialSync.current = false;

    webContainerService.enqueueSystem(async (instance) => {
      try {
        const pkgJson = {
          name: 'playground',
          type: 'module',
          private: true,
          dependencies: Object.fromEntries(SYSTEM_DEPS.map(d => [d, 'latest']))
        };

        await instance.fs.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
        await instance.fs.writeFile('tsconfig.json', tsConfigString);
        await instance.fs.writeFile('index.ts', tsCode);
        await instance.fs.mkdir('dist', { recursive: true });

        addMessage('info', ['Preparing environment...']);

        const installProcess = await instance.spawn('npm', ['install', '--no-progress']);

        let installBuffer = '';
        installProcess.output.pipeTo(new WritableStream({
          write(out) {
             installBuffer += out;
             const lines = installBuffer.split('\n');
             installBuffer = lines.pop() || '';
             for (const line of lines) {
               const clean = line.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
               if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
             }
          }
        }));

        const exitCode = await installProcess.exit;
        if (exitCode === 0) {
          await syncTypes();

          addMessage('info', ['Starting reactive compiler (tsc --watch)...']);

          // Execute tsc --watch directly
          const tscProcess = await instance.spawn('./node_modules/.bin/tsc', ['--watch', '--incremental']);

          // Log compiler progress/errors
          let tscBuffer = '';
          tscProcess.output.pipeTo(new WritableStream({
            write(chunk) {
               tscBuffer += chunk;
               const lines = tscBuffer.split('\n');
               tscBuffer = lines.pop() || '';
               for (const line of lines) {
                 const clean = line.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
                 if (clean.includes('error TS') || clean.includes('Found 0 errors')) {
                    addMessage(clean.includes('error TS') ? 'error' : 'info', [clean]);
                 }
               }
            }
          }));

          // Watch the output directory for reactive state updates
          watchDist();

          // Robust check for first emit
          let retries = 0;
          const checkEmit = async () => {
            try {
              const content = await instance.fs.readFile('dist/index.js', 'utf8');
              if (content.trim()) {
                webContainerService.markEnvReady();
                addMessage('info', ['Environment ready.']);
              } else {
                 throw new Error('Empty artifact');
              }
            } catch (e) {
              if (retries < 60) {
                retries++;
                setTimeout(checkEmit, 1000);
              } else {
                webContainerService.markEnvReady();
                addMessage('info', ['Environment ready (compiler slow).']);
              }
            }
          };
          checkEmit();
        } else {
           addMessage('error', [`npm install failed with code ${exitCode}.`]);
           webContainerService.markEnvReady();
        }
      } catch (error) {
        const msg = (error as Error).message || String(error);
        console.error('Failed to boot environment:', error);
        addMessage('error', [`Environment boot failed: ${msg}`]);
        webContainerService.markEnvReady();
      }
    });
  }, []);

  useEffect(() => {
    webContainerService.enqueue(async (instance) => {
        await instance.fs.writeFile('index.ts', tsCode);
    });
  }, [tsCode]);

  useEffect(() => {
    webContainerService.enqueue(async (instance) => {
        await instance.fs.writeFile('tsconfig.json', tsConfigString);
    });
  }, [tsConfigString]);

  return { externalTypings, syncTypes };
}
