import { useEffect, useRef, useCallback, useState } from 'react';
import { webContainerService, SYSTEM_DEPS } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';

/**
 * useWebContainer coordinates the VM initialization and background compiler lifecycle.
 * It observes the WebContainerService and drives the environment preparation.
 */
export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  onArtifactsChange: (js: string, dts: string) => void
) {
  const isInitialSync = useRef(true);
  const [externalTypings, setExternalTypings] = useState<Record<string, string>>({});

  const syncTypes = useCallback(async () => {
    try {
      const types = await webContainerService.readDirRecursive('node_modules', (path) => path.endsWith('.d.ts'));
      setExternalTypings(types);
    } catch (err) {
      console.error('Failed to sync types:', err);
    }
  }, []);

  const watchDist = useCallback(async () => {
    const wc = await webContainerService.getInstance();

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

    sync(); // Initial sync
  }, [onArtifactsChange]);

  // Subscribe to service logs
  useEffect(() => {
    const unsubscribeLog = webContainerService.onLog((log) => {
      addMessage(log.type as any, [log.message]);
    });
    return () => unsubscribeLog();
  }, [addMessage]);

  useEffect(() => {
    if (!isInitialSync.current) return;
    isInitialSync.current = false;

    webContainerService.enqueue(async (instance) => {
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

        webContainerService.emitLog('info', 'Preparing environment...');
        webContainerService.setStatus('preparing');

        const { exit } = await webContainerService.spawnManaged('npm', ['install', '--no-progress'], { silent: false });
        const exitCode = await exit;

        if (exitCode === 0) {
          await syncTypes();
          webContainerService.emitLog('info', 'Starting reactive compiler...');

          await webContainerService.spawnManaged('./node_modules/.bin/tsc', ['--watch', '--incremental'], {
            silent: true,
            onLog: (line) => {
              if (line.toLowerCase().includes('compilation') || line.toLowerCase().includes('change')) {
                webContainerService.startBuild();
              }
              if (line.includes('errors') || line.includes('Watching') || line.includes('error TS')) {
                webContainerService.finishBuild();
                if (line.includes('error TS') || line.includes('Found')) {
                    webContainerService.emitLog(line.includes('error TS') ? 'error' : 'info', line);
                }
              }
            }
          });

          watchDist();

          let retries = 0;
          const checkEmit = async () => {
            try {
              const content = await instance.fs.readFile('dist/index.js', 'utf8');
              if (content.trim()) {
                webContainerService.markEnvReady();
                webContainerService.emitLog('info', 'Environment ready.');
              } else throw new Error('Empty');
            } catch (e) {
              if (retries < 60) {
                retries++;
                setTimeout(checkEmit, 1000);
              } else {
                webContainerService.markEnvReady();
                webContainerService.emitLog('info', 'Environment ready (compiler slow).');
              }
            }
          };
          checkEmit();
        } else {
           webContainerService.emitLog('error', `Environment preparation failed (code ${exitCode}).`);
           webContainerService.markEnvReady();
        }
      } catch (error) {
        webContainerService.emitLog('error', `VM Error: ${(error as Error).message}`);
        webContainerService.markEnvReady();
      }
    }, false); // Do not wait for ready when initializing the ready state
  }, []);

  useEffect(() => {
    webContainerService.enqueue(async (instance) => {
        await webContainerService.writeFile('index.ts', tsCode);
    });
  }, [tsCode]);

  useEffect(() => {
    webContainerService.enqueue(async (instance) => {
        await webContainerService.writeFile('tsconfig.json', tsConfigString);
    });
  }, [tsConfigString]);

  return { externalTypings, syncTypes };
}
