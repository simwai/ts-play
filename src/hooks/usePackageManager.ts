import { useState, useEffect, useRef, useCallback } from 'react';
import { workerClient } from '../lib/workerClient';
import { webContainerService } from '../lib/webcontainer';
import type { InstalledPackage } from '../components/PackageManager';
import type { ConsoleMessage } from '../components/Console';

/**
 * Built-in Node.js modules that should not be attempted for installation.
 */
const BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
]);

export type PackageManagerStatus = 'idle' | 'installing' | 'uninstalling' | 'syncing' | 'error';

/**
 * Hook to manage user-imported packages in the WebContainer.
 * Handles automatic import detection and protects core system dependencies.
 */
export function usePackageManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
) {
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [status, setStatus] = useState<PackageManagerStatus>('idle');
  const tasksInProgress = useRef(0);

  // Track previous packages to detect changes
  const previousPkgsRef = useRef<Set<string>>(new Set());
  const installQueue = useRef<Promise<void>>(Promise.resolve());

  const updateBusyState = useCallback((busy: boolean, type: PackageManagerStatus = 'idle') => {
    if (busy) {
      tasksInProgress.current++;
      setStatus(type);
    } else {
      tasksInProgress.current = Math.max(0, tasksInProgress.current - 1);
      if (tasksInProgress.current === 0) setStatus('idle');
    }
  }, []);

  const tsCursorPos = useRef(0);
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Detects imports in the source code and filters out system/built-in modules.
   */
  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current);
    checkImportsTimeout.current = setTimeout(async () => {
      try {
        const detected = await workerClient.detectImports(tsCode);
        const filtered = [...detected].filter(
          (pkg) =>
            !pkg.startsWith('node:') &&
            !BUILTIN_MODULES.has(pkg) &&
            !WebContainerService.SYSTEM_DEPS.includes(pkg)
        );
        const detectedSorted = filtered.sort();

        setInstalledPackages((prev) => {
          const prevNames = prev.map((p) => p.name).sort();
          if (JSON.stringify(prevNames) === JSON.stringify(detectedSorted)) return prev;
          return detectedSorted.map((name) => ({ name, version: 'latest' }));
        });
      } catch (error) {
        console.error('Failed to detect imports:', error);
      }
    }, 1000);
  }, [tsCode]);

  useEffect(() => {
    checkImports();
  }, [tsCode, checkImports]);

  /**
   * Syncs detected packages with the WebContainer's node_modules.
   * Protects core system dependencies from being uninstalled.
   */
  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name));
    const previousNames = previousPkgsRef.current;

    // Calculate changes, ensuring system deps are never removed
    const added = [...currentNames].filter((x) => !previousNames.has(x));
    const removed = [...previousNames].filter(
      (x) => !currentNames.has(x) && !WebContainerService.SYSTEM_DEPS.includes(x)
    );

    if (added.length === 0 && removed.length === 0) return;
    previousPkgsRef.current = currentNames;

    const performChanges = async () => {
      await webContainerService.getEnvReady();
      updateBusyState(true, added.length > 0 ? 'installing' : 'uninstalling');
      try {
        if (removed.length > 0) {
          addMessage('info', [`npm uninstall ${removed.join(' ')}...`]);
          const { exit } = await webContainerService.spawn('npm', ['uninstall', ...removed], (out) => {
            const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
            if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
          });
          await exit;
        }
        if (added.length > 0) {
          addMessage('info', [`npm install ${added.join(' ')}...`]);
          const { exit } = await webContainerService.spawn('npm', ['install', '--no-progress', ...added], (out) => {
            const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim();
            if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean]);
          });
          await exit;
        }
      } catch (error) {
        console.error('Package management failed:', error);
        addMessage('error', ['Package manager error: ' + (error as Error).message]);
      } finally {
        updateBusyState(false);
      }
    };

    installQueue.current = installQueue.current.then(performChanges);
  }, [installedPackages, addMessage, updateBusyState]);

  return {
    installedPackages,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
    packageTypings: {} as Record<string, string>,
  };
}

// Helper to access static constant in hook context
import { webContainerService as wcs } from '../lib/webcontainer';
const WebContainerService = (wcs as any).constructor;
