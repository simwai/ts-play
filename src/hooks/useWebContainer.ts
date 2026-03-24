import { useEffect, useRef, useCallback, useState } from 'react';
import { webContainerService, SYSTEM_DEPS, type CompilerStatus } from '../lib/webcontainer';
import type { ConsoleMessage } from '../components/Console';

const DETECT_IMPORTS_SCRIPT = `
const fs = require('fs');
const code = process.argv[2] || '';
const imports = [];
const regex = /(?:import\\s+(?:[\\w\\s{},*]+)\\s+from\\s+['"]([^'"]+)['"])|(?:import\\(['"]([^'"]+)['"]\\))|(?:require\\(['"]([^'"]+)['"]\\))/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const name = match[1] || match[2] || match[3];
  if (name && !name.startsWith('.') && !name.startsWith('/')) {
    const parts = name.split('/');
    const pkg = name.startsWith('@') ? \`\${parts[0]}/\${parts[1]}\` : parts[0];
    imports.push(pkg);
  }
}
console.log(JSON.stringify([...new Set(imports)]));
`;

export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  onArtifactsChange: (js: string, dts: string) => void
) {
  const isInitialSync = useRef(true);
  const [externalTypings, setExternalTypings] = useState<Record<string, string>>({});
  const [tscStatus, setTscStatus] = useState<CompilerStatus>('Idle');
  const [parcelStatus, setParcelStatus] = useState<CompilerStatus>('Idle');

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
    wc.fs.watch('dist', { recursive: true }, sync);
    sync();
  }, [onArtifactsChange]);

  useEffect(() => {
    const unsubscribeLog = webContainerService.onLog((log) => {
      addMessage(log.type as any, [log.message]);
    });
    const unsubscribeStatus = webContainerService.onCompilerStatus(() => {
      setTscStatus(webContainerService.tscStatus);
      setParcelStatus(webContainerService.parcelStatus);
    });
    return () => {
      unsubscribeLog();
      unsubscribeStatus();
    };
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
          main: 'dist/index.js',
          dependencies: Object.fromEntries(SYSTEM_DEPS.map(d => [d, 'latest'])),
        };

        await webContainerService.mount({
          'package.json': { file: { contents: JSON.stringify(pkgJson, null, 2) } },
          'tsconfig.json': { file: { contents: tsConfigString } },
          'index.ts': { file: { contents: tsCode } },
          '__detect_imports.cjs': { file: { contents: DETECT_IMPORTS_SCRIPT } },
          'dist': { directory: {} }
        });

        webContainerService.emitLog('info', 'Preparing environment (esbuild)...');
        webContainerService.setCompilerStatus('tsc', 'Preparing');
        webContainerService.setCompilerStatus('parcel', 'Preparing');

        const proc = await webContainerService.spawnManaged('npm', ['install', '--no-progress'], { silent: false });
        const exitCode = await proc.exit;

        if (exitCode === 0) {
          await syncTypes();
          webContainerService.emitLog('info', 'Starting reactive compilers...');

          const buildScript = `
            const { build } = require('esbuild');
            const fs = require('fs');
            let timeout;
            async function doBuild() {
               console.log('Building...');
               try {
                 await build({
                   entryPoints: ['index.ts'],
                   bundle: true,
                   platform: 'node',
                   format: 'esm',
                   outfile: 'dist/index.js',
                   sourcemap: false,
                 });
                 console.log('Build finished.');
               } catch (e) {
                 console.log('Build failed.');
                 console.log(e.message);
               }
            }
            fs.watch('index.ts', (event) => {
               if (event === 'change') {
                 clearTimeout(timeout);
                 timeout = setTimeout(doBuild, 100);
               }
            });
            doBuild();
          `;
          await webContainerService.writeFile('__build.cjs', buildScript);

          await webContainerService.spawnManaged('node', ['__build.cjs'], {
            silent: false,
            onLog: (line) => {
              if (line.includes('Building')) {
                webContainerService.setCompilerStatus('parcel', 'Compiling');
                webContainerService.notifyBuildStart();
              }
              if (line.includes('Build finished')) {
                webContainerService.setCompilerStatus('parcel', 'Ready');
                webContainerService.notifyBuildComplete();
              }
              if (line.includes('Build failed')) {
                webContainerService.setCompilerStatus('parcel', 'Error');
              }
            }
          });

          await webContainerService.spawnManaged('./node_modules/.bin/tsc', ['--watch', '--emitDeclarationOnly', '--incremental'], {
            silent: true,
            onLog: (line) => {
               if (line.includes('Starting incremental compilation') || line.includes('File change detected')) {
                  webContainerService.setCompilerStatus('tsc', 'Compiling');
               }
               if (line.includes('Found 0 errors') || line.includes('Watching for file changes')) {
                  webContainerService.setCompilerStatus('tsc', 'Ready');
               }
               if (line.includes('error TS')) {
                 webContainerService.setCompilerStatus('tsc', 'Error');
                 webContainerService.emitLog('error', `[TSC] ${line}`);
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
              if (retries < 60) { retries++; setTimeout(checkEmit, 1000); }
              else { webContainerService.markEnvReady(); webContainerService.emitLog('info', 'Environment ready (compiler slow).'); }
            }
          };
          checkEmit();
        } else {
           webContainerService.emitLog('error', `Preparation failed.`);
           webContainerService.setCompilerStatus('tsc', 'Error');
           webContainerService.setCompilerStatus('parcel', 'Error');
           webContainerService.markEnvReady();
        }
      } catch (error) {
        webContainerService.emitLog('error', `VM Error: ${(error as Error).message}`);
        webContainerService.markEnvReady();
      }
    });
  }, []);

  useEffect(() => {
    webContainerService.enqueue(async () => {
        await webContainerService.writeFile('index.ts', tsCode);
    });
  }, [tsCode]);

  useEffect(() => {
    webContainerService.enqueue(async () => {
        await webContainerService.writeFile('tsconfig.json', tsConfigString);
    });
  }, [tsConfigString]);

  return { externalTypings, syncTypes, tscStatus, parcelStatus };
}
