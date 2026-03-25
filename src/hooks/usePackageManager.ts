import { useState, useEffect, useRef, useCallback } from 'react';
import { webContainerService, SYSTEM_DEPS } from '../lib/webcontainer';
import { playgroundStore } from '../lib/state-manager';
import type { ConsoleMessage } from '../components/Console';

const BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

export type PackageManagerStatus = 'idle' | 'installing' | 'uninstalling' | 'syncing' | 'error';

export function usePackageManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
) {
  const [installedPackages, setInstalledPackages] = useState<{name: string, version: string}[]>([]);
  const tasksInProgress = useRef(0);
  const previousPkgsRef = useRef<Set<string>>(new Set(SYSTEM_DEPS));
  const installQueue = useRef<Promise<void>>(Promise.resolve());
  const tsCursorPos = useRef(0);

  const updateBusyState = useCallback((busy: boolean, type: PackageManagerStatus = 'idle') => {
    if (busy) {
      tasksInProgress.current++;
      playgroundStore.setState({ packageManagerStatus: type });
    } else {
      tasksInProgress.current = Math.max(0, tasksInProgress.current - 1);
      if (tasksInProgress.current === 0) playgroundStore.setState({ packageManagerStatus: 'idle' });
    }
  }, []);

  const checkImports = useCallback(() => {
    const timeout = setTimeout(async () => {
      try {
        await webContainerService.enqueue(async () => {
          let output = '';
          const proc = await webContainerService.spawnManaged('node', ['__detect_imports.cjs', tsCode], {
            silent: true,
            onLog: (line) => { output += line; }
          });
          await proc.exit;

          const trimmed = output.trim();
          if (!trimmed) return;

          try {
            const detected = JSON.parse(trimmed) as string[];
            const filtered = detected.filter(
              (pkg) =>
                !pkg.startsWith('node:') &&
                !pkg.startsWith('.') &&
                !BUILTIN_MODULES.has(pkg) &&
                !SYSTEM_DEPS.includes(pkg)
            );
            const detectedSorted = filtered.sort();

            setInstalledPackages((prev) => {
              const prevNames = prev.map((p) => p.name).sort();
              if (JSON.stringify(prevNames) === JSON.stringify(detectedSorted)) return prev;
              return detectedSorted.map((name) => ({ name, version: 'latest' }));
            });
          } catch {}
        });
      } catch (error) {
        console.error('Failed to detect imports:', error);
      }
    });
    return () => clearTimeout(timeout);
  }, [tsCode]);

  useEffect(() => {
    return checkImports();
  }, [tsCode, checkImports]);

  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name));
    const previousNames = previousPkgsRef.current;

    const added = [...currentNames].filter((x) => !previousNames.has(x));
    const removed = [...previousNames].filter(
      (x) => !currentNames.has(x) && !SYSTEM_DEPS.includes(x)
    );

    if (added.length === 0 && removed.length === 0) return;
    previousPkgsRef.current = currentNames;

    const performChanges = async () => {
      await webContainerService.enqueue(async () => {
        updateBusyState(true, added.length > 0 ? 'installing' : 'uninstalling');

        try {
          if (removed.length > 0) {
            webContainerService.emitLog('info', `npm uninstall ${removed.join(' ')}...`);
            const proc = await webContainerService.spawnManaged('npm', ['uninstall', ...removed]);
            await proc.exit;
          }
          if (added.length > 0) {
            webContainerService.emitLog('info', `npm install ${added.join(' ')}...`);
            const proc = await webContainerService.spawnManaged('npm', ['install', '--no-progress', ...added]);
            await proc.exit;
          }
        } catch (error) {
          console.error('Package management failed:', error);
          webContainerService.emitLog('error', `Package manager error: ${(error as Error).message}`);
        } finally {
          updateBusyState(false);
        }
      });
    };

    installQueue.current = performChanges();
  }, [installedPackages, updateBusyState]);

  return {
    installedPackages,
    tsCursorPos,
    checkImports,
    installQueue: installQueue.current,
    packageTypings: {} as Record<string, string>,
  };
}
