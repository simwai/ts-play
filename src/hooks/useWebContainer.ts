import { useEffect, useRef, useCallback, useState } from 'react';
import { webContainerService } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';

/**
 * Hook to manage the lifecycle of the WebContainer environment.
 * Handles the initial boot, system installations, and type extraction.
 */
export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
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

  useEffect(() => {
    webContainerService.getInstance().then(async (instance) => {
      try {
        if (isInitialSync.current) {
          isInitialSync.current = false;

          const pkgJson = {
            name: 'playground',
            type: 'module',
            private: true,
            dependencies: {
              'vite-node': '^3.0.0',
              'esbuild': '^0.24.0',
              'prettier': '^3.0.0',
              'typescript': '^5.0.0',
              'lodash-es': '^4.17.21'
            }
          };

          await instance.fs.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
          await instance.fs.writeFile('tsconfig.json', tsConfigString);
          await instance.fs.writeFile('index.ts', tsCode);

          addMessage('info', ['Preparing environment...']);
          const { exit } = await webContainerService.spawn('npm', ['install', '--no-progress'], (out) => {
             const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
             if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
          });

          const exitCode = await exit;
          if (exitCode === 0) {
            await syncTypes();
            webContainerService.markEnvReady();
            addMessage('info', ['Environment ready.']);
          } else {
             addMessage('error', ['npm install failed. Check console.']);
          }
        }
      } catch (error) {
        console.error('Failed to sync config files to WebContainer:', error);
      }
    });
  }, []);

  // Sync TS and TSConfig changes to WebContainer
  useEffect(() => {
    webContainerService.writeFile('index.ts', tsCode);
  }, [tsCode]);

  useEffect(() => {
    webContainerService.writeFile('tsconfig.json', tsConfigString);
  }, [tsConfigString]);

  return { externalTypings, syncTypes };
}
