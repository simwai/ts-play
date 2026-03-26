import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { webContainerService, SYSTEM_DEPS } from '../lib/webcontainer';
import { playgroundStore } from '../lib/state-manager';
import { usePlaygroundStore } from './usePlaygroundStore';
import type { ConsoleMessage } from '../components/Console';
import { db } from '../lib/db';
import { RegexPatterns, toRegExp } from '../lib/regex';

const DETECT_IMPORTS_SCRIPT = `
const fs = require('fs');
const code = process.argv[2] || '';
const imports = [];
const regex = ${RegexPatterns.IMPORT_EXPORT};
let match;
while ((match = regex.exec(code)) !== null) {
  const name = match[1] || match[2] || match[3] || match[4] || match[5];
  if (name && !name.startsWith('.') && !name.startsWith('/')) {
    const parts = name.split('/');
    const pkg = name.startsWith('@') ? \`\${parts[0]}/\${parts[1]}\` : parts[0];
    imports.push(pkg);
  }
}
console.log(JSON.stringify([...new Set(imports)]));
`;

const VALIDATE_CONFIG_SCRIPT = `
const fs = require('fs');
let config = '';
process.stdin.on('data', chunk => { config += chunk; });
process.stdin.on('end', () => {
  try {
    JSON.parse(config);
    console.log(JSON.stringify({ valid: true }));
  } catch (e) {
    console.log(JSON.stringify({ valid: false, error: e.message }));
  }
});
`;

export function useWebContainer(
  tsConfigString: string,
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  onArtifactsChange: (js: string, dts: string) => void
) {
  const isInitialSync = useRef(true);
  const startTime = useRef(Date.now());
  const { inlineDeps } = usePlaygroundStore();
  const esbuildProcRef = useRef<any>(null);

  const [nodeTypings, setNodeTypings] = useState<Record<string, string>>({});
  const [emittedTypings, setEmittedTypings] = useState<Record<string, string>>({});

  const syncNodeTypes = useCallback(async () => {
    try {
      const nodeTypes = await webContainerService.readDirRecursive('node_modules', (p) => p.endsWith('.d.ts'));
      setNodeTypings(nodeTypes);
    } catch {}
  }, []);

  const syncEmittedTypes = useCallback(async () => {
    try {
      const emitted = await webContainerService.readDirRecursive('dist', (p) => p.endsWith('.d.ts'));
      // Normalize dist/index.d.ts to index.d.ts for Monaco
      if (emitted['dist/index.d.ts']) {
         emitted['index.d.ts'] = emitted['dist/index.d.ts'];
      }
      setEmittedTypings(emitted);
    } catch {}
  }, []);

  const externalTypings = useMemo(() => ({ ...nodeTypings, ...emittedTypings }), [nodeTypings, emittedTypings]);

  const watchDist = useCallback(async () => {
    const wc = await webContainerService.getInstance();

    // Initial sync
    const sync = async () => {
      try {
        const js = await wc.fs.readFile('dist/index.js', 'utf8').catch(() => '');
        const dts = await wc.fs.readFile('dist/index.d.ts', 'utf8').catch(() => '');
        onArtifactsChange(js, dts);
        await syncEmittedTypes();
      } catch {}
    };

    // Watch for changes in dist/
    wc.fs.watch('dist', { recursive: true }, (event, filename) => {
       if (filename === 'index.js' || filename === 'index.d.ts') {
          sync();
       }
    });

    sync();
  }, [onArtifactsChange, syncNodeTypes, syncEmittedTypes]);

  useEffect(() => {
    return webContainerService.onLog((log) => {
      addMessage(log.type as any, [log.message]);
    });
  }, [addMessage]);

  const prepareEnvironment = async () => {
    const pkgJson = {
      name: 'playground',
      type: 'module',
      private: true,
      main: 'dist/index.js',
      dependencies: Object.fromEntries(SYSTEM_DEPS.map(d => [d, 'latest'])),
    };

    try {
      const localSnapshot = await db.getLatestSnapshot('playground');
      if (localSnapshot) {
        webContainerService.emitLog('info', '📦 Loading last session snapshot from IndexedDB...');
        await webContainerService.mountRawSnapshot(localSnapshot.data);
      } else {
        webContainerService.emitLog('info', '🟣 Fetching initial environment snapshot...');
        await webContainerService.mountSnapshot('/base.snapshot');
      }
      webContainerService.emitLog('info', '🚀 Snapshot mounted! Ensuring configuration integrity.');
      await webContainerService.writeFile('package.json', JSON.stringify(pkgJson, null, 2));
    } catch (e) {
      webContainerService.emitLog('info', '⚠️ Snapshot loading failed, performing full mount & install...');
      await webContainerService.mount({
        'package.json': { file: { contents: JSON.stringify(pkgJson, null, 2) } },
        'tsconfig.json': { file: { contents: tsConfigString } },
        'index.ts': { file: { contents: tsCode } },
        '__validate_config.cjs': { file: { contents: VALIDATE_CONFIG_SCRIPT } },
        '__detect_imports.cjs': { file: { contents: DETECT_IMPORTS_SCRIPT } },
        'dist': { directory: {} }
      });

      webContainerService.emitLog('info', 'Preparing environment (npm install)...');
      const proc = await webContainerService.spawnManaged('npm', ['install', '--no-progress'], { silent: false });
      const exitCode = await proc.exit;
      if (exitCode !== 0) throw new Error('NPM install failed.');
    }

    const [existingTs, existingTsConfig, existingDetect, existingValidate] = await Promise.all([
      webContainerService.readFile('index.ts').catch(() => ''),
      webContainerService.readFile('tsconfig.json').catch(() => ''),
      webContainerService.readFile('__detect_imports.cjs').catch(() => ''),
      webContainerService.readFile('__validate_config.cjs').catch(() => '')
    ]);

    if (existingTs !== tsCode) await webContainerService.writeFile('index.ts', tsCode);
    if (existingTsConfig !== tsConfigString) await webContainerService.writeFile('tsconfig.json', tsConfigString);
    if (existingDetect !== DETECT_IMPORTS_SCRIPT) await webContainerService.writeFile('__detect_imports.cjs', DETECT_IMPORTS_SCRIPT);
    if (existingValidate !== VALIDATE_CONFIG_SCRIPT) await webContainerService.writeFile('__validate_config.cjs', VALIDATE_CONFIG_SCRIPT);

    const wc = await webContainerService.getInstance();
    await wc.fs.mkdir('dist', { recursive: true }).catch(() => {});
  };

  const startEsbuild = async () => {
    if (esbuildProcRef.current) {
      esbuildProcRef.current.kill();
    }

    const buildScript = `
      const { build } = require('esbuild');
      const fs = require('fs');
      let timeout;
      async function doBuild(force = true) {
         if (!force && fs.existsSync('dist/index.js')) {
            console.log('Build JS finished (restored from snapshot).');
            return;
         }
         console.log('Building JS...');
         try {
           const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
           const deps = Object.keys(pkg.dependencies || {});
           const external = ${inlineDeps ? '[]' : 'deps.flatMap(d => [d, d + "/*"])'};
           await build({
             entryPoints: ['index.ts'],
             bundle: true,
             platform: 'node',
             format: 'esm',
             outfile: 'dist/index.js',
             sourcemap: true,
             treeShaking: true,
             target: 'node20',
             external,
           });
           console.log('Build JS finished.');
         } catch (e) { console.log('Build JS failed.'); console.log(e.message); }
      }
      fs.watch('index.ts', (event) => {
         if (event === 'change') { clearTimeout(timeout); timeout = setTimeout(() => doBuild(true), 100); }
      });
      doBuild(false);
    `;
    await webContainerService.writeFile('__build.cjs', buildScript);

    esbuildProcRef.current = await webContainerService.spawnManaged('node', ['__build.cjs'], {
      silent: false,
      onLog: (line) => {
        if (line.includes('Building JS')) {
          playgroundStore.setState({ esbuildStatus: 'Compiling' });
        }
        if (line.includes('Build JS finished') || line.includes('restored from snapshot')) {
          playgroundStore.setState({ esbuildStatus: 'Ready' });
        }
        if (line.includes('Build JS failed')) {
          playgroundStore.setState({ esbuildStatus: 'Error' });
        }
      }
    });
  };

  const startTsc = async () => {
    await webContainerService.spawnManaged('npx', ['tsc', '--watch', '--emitDeclarationOnly', '--incremental', '--outDir', 'dist', '--rootDir', '.'], {
      silent: true,
      onLog: (line) => {
         if (line.includes('Starting incremental compilation') || line.includes('File change detected')) {
            playgroundStore.setState({ tscStatus: 'Compiling' });
         }
         if (line.includes('Found 0 errors') || line.includes('Watching for file changes')) {
            playgroundStore.setState({ tscStatus: 'Ready' });
         }
         if (line.includes('error TS')) {
           playgroundStore.setState({ tscStatus: 'Error' });
           webContainerService.emitLog('error', `[TSC] ${line}`);
         }
      }
    });
  };

  useEffect(() => {
    if (!isInitialSync.current) return;
    isInitialSync.current = false;

    webContainerService.enqueue(async () => {
      try {
        playgroundStore.setState({
            lifecycle: 'preparing',
            tscStatus: 'Preparing',
            esbuildStatus: 'Preparing'
        });

        await prepareEnvironment();
        await Promise.all([syncNodeTypes(), syncEmittedTypes()]);

        webContainerService.emitLog('info', 'Starting reactive compilers...');
        await startEsbuild();
        await startTsc();

        watchDist();

        let retries = 0;
        const checkEmit = async () => {
          try {
            const js = await webContainerService.readFile('dist/index.js').catch(() => '');
            const dts = await webContainerService.readFile('dist/index.d.ts').catch(() => '');

            if (js.trim() && dts.trim()) {
              const bootDuration = (Date.now() - startTime.current) / 1000;
              playgroundStore.setState({ lifecycle: 'ready', tscStatus: 'Ready', esbuildStatus: 'Ready', bootTime: bootDuration });
              webContainerService.emitLog('info', `Environment ready in ${bootDuration.toFixed(2)}s.`);
            } else {
              throw new Error('Emission incomplete');
            }
          } catch (e) {
            if (retries < 60) {
              retries++;
              setTimeout(checkEmit, 1000);
            } else {
              playgroundStore.setState({ lifecycle: 'ready' });
              webContainerService.emitLog('info', 'Environment ready (compiler slow).');
            }
          }
        };
        checkEmit();
      } catch (error: any) {
        webContainerService.emitLog('error', `VM Error: ${error.message}`);
        playgroundStore.setState({ lifecycle: 'error' });
      }
    });
  }, []);

  // Restart esbuild when inlineDeps changes
  useEffect(() => {
    if (playgroundStore.getState().lifecycle === 'ready') {
       webContainerService.enqueue(async () => {
         await startEsbuild();
       });
    }
  }, [inlineDeps]);

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


  const { packageManagerStatus } = usePlaygroundStore();
  useEffect(() => {
    if (packageManagerStatus === 'idle' && !isInitialSync.current) {
       syncNodeTypes();
    }
  }, [packageManagerStatus, syncNodeTypes]);

  return { externalTypings, syncNodeTypes, syncEmittedTypes };
}
