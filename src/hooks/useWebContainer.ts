import { useEffect, useRef, useCallback, useState } from 'react';
import { webContainerService, SYSTEM_DEPS } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';

/**
 * useWebContainer manages the entire lifecycle of the browser-based environment.
 * It is responsible for the initial boot, writing system configuration files,
 * performing the first npm install, and keeping the environment in sync with the UI.
 */
export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const isInitialSync = useRef(true);
  const [externalTypings, setExternalTypings] = useState<Record<string, string>>({});

  /**
   * Scans node_modules for .d.ts files and synchronizes them to Monaco.
   * This provides full IntelliSense for all installed packages.
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
   * The core initialization loop.
   * Enqueued in the system queue to ensure order.
   */
  useEffect(() => {
    if (!isInitialSync.current) return;
    isInitialSync.current = false;

    webContainerService.enqueueSystem(async (instance) => {
      try {
        // Prepare a standard Node.js project structure
        const pkgJson = {
          name: 'playground',
          type: 'module',
          private: true,
          dependencies: Object.fromEntries(SYSTEM_DEPS.map(d => [d, 'latest']))
        };

        await instance.fs.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
        await instance.fs.writeFile('tsconfig.json', tsConfigString);
        await instance.fs.writeFile('index.ts', tsCode);

        addMessage('info', ['Preparing environment...']);

        // Use the service's spawn method to run the first install
        const process = await instance.spawn('npm', ['install', '--no-progress']);

        process.output.pipeTo(
          new WritableStream({
            write(out) {
               const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
               if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
            },
          })
        );

        const exitCode = await process.exit;
        if (exitCode === 0) {
          // After successful install, perform an initial type sync
          await syncTypes();
          // Signal to other hooks (e.g., compiler manager) that the environment is ready
          webContainerService.markEnvReady();
          addMessage('info', ['Environment ready.']);
        } else {
           addMessage('error', ['npm install failed. Please check the console output.']);
           // Still mark as ready so the queue can proceed or retry
           webContainerService.markEnvReady();
        }
      } catch (error) {
        console.error('Failed to synchronize environment:', error);
        addMessage('error', ['Failed to synchronize environment: ' + (error as Error).message]);
        webContainerService.markEnvReady();
      }
    });
  }, []);

  /**
   * Keep the WebContainer's virtual filesystem in sync with the React state.
   */
  useEffect(() => {
    webContainerService.writeFile('index.ts', tsCode);
  }, [tsCode]);

  useEffect(() => {
    webContainerService.writeFile('tsconfig.json', tsConfigString);
  }, [tsConfigString]);

  return { externalTypings, syncTypes };
}
