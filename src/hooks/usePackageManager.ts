import { useState, useEffect, useRef, useCallback } from 'react';
import { workerClient } from '../lib/workerClient';
import { runCommand, getWebContainer } from '../lib/webcontainer';
import { setupTypeAcquisition } from '@typescript/ata';
import type { InstalledPackage } from '../components/PackageManager';
import type { ConsoleMessage } from '../components/Console';
import * as TS from 'typescript';

const BUILTIN_MODULES = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
]);

export type PackageManagerStatus =
  | 'idle'
  | 'installing'
  | 'uninstalling'
  | 'syncing'
  | 'error';

export function usePackageManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
) {
  const [installedPackages, setInstalledPackages] = useState<
    InstalledPackage[]
  >([]);
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>(
    {},
  );
  const [status, setStatus] = useState<PackageManagerStatus>('idle');

  const previousPkgsRef = useRef<Set<string>>(new Set());
  const installQueue = useRef<Promise<void>>(Promise.resolve());
  const ataRef = useRef<any>(null);

  const pendingTypings = useRef<Record<string, string>>({});
  const typingUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Robust task counter for background status management
  const tasksInProgress = useRef(0);
  const updateBusyState = useCallback(
    (busy: boolean, type: PackageManagerStatus = 'idle') => {
      if (busy) {
        tasksInProgress.current++;
        setStatus(type);
      } else {
        tasksInProgress.current = Math.max(0, tasksInProgress.current - 1);
        if (tasksInProgress.current === 0) {
          setStatus('idle');
        }
      }
    },
    [],
  );

  const tsCursorPos = useRef(0);
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current);
    checkImportsTimeout.current = setTimeout(async () => {
      const lines = tsCode.split('\n');
      const cursorLineIdx =
        tsCode.slice(0, tsCursorPos.current).split('\n').length - 1;
      const currentLine = lines[cursorLineIdx] || '';

      if (
        /\bimport\b/.test(currentLine) &&
        !currentLine.includes('from') &&
        !currentLine.includes('import(')
      ) {
        return;
      }

      try {
        const detected = await workerClient.detectImports(tsCode);
        const filtered = [...detected].filter(
          (pkg) => !pkg.startsWith('node:') && !BUILTIN_MODULES.has(pkg),
        );
        const detectedSorted = filtered.sort();

        setInstalledPackages((prev) => {
          const prevNames = prev.map((p) => p.name).sort();
          if (JSON.stringify(prevNames) === JSON.stringify(detectedSorted))
            return prev;
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

  const flushTypings = useCallback(() => {
    if (Object.keys(pendingTypings.current).length === 0) return;
    setPackageTypings((prev) => ({ ...prev, ...pendingTypings.current }));
    pendingTypings.current = {};
  }, []);

  useEffect(() => {
    if (!ataRef.current) {
      ataRef.current = setupTypeAcquisition({
        projectName: 'ts-play',
        typescript: TS as any,
        logger: false,
        delegate: {
          receivedFile: (code, path) => {
            pendingTypings.current[path] = code;
            if (typingUpdateTimer.current)
              clearTimeout(typingUpdateTimer.current);
            typingUpdateTimer.current = setTimeout(flushTypings, 500);
          },
          finished: () => {
            flushTypings();
            updateBusyState(false);
          },
          started: () => {
            updateBusyState(true, 'syncing');
          },
        },
      });
    }
  }, [flushTypings, updateBusyState]);

  useEffect(() => {
    if (ataRef.current && tsCode) {
      ataRef.current(tsCode);
    }
  }, [tsCode]);

  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name));
    const previousNames = previousPkgsRef.current;
    const added = [...currentNames].filter((x) => !previousNames.has(x));
    const removed = [...previousNames].filter((x) => !currentNames.has(x));

    if (added.length === 0 && removed.length === 0) return;
    previousPkgsRef.current = currentNames;

    const performChanges = async () => {
      updateBusyState(true, added.length > 0 ? 'installing' : 'uninstalling');
      try {
        if (removed.length > 0) {
          addMessage('info', ['npm uninstall ' + removed.join(' ') + '...']);
          const { exit } = await runCommand(
            'npm',
            ['uninstall', ...removed],
            (out) => {
              const clean = out
                .replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '')
                .trim();
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean]);
            },
          );
          const exitCode = await exit;
          if (exitCode !== 0)
            throw new Error(`npm uninstall failed with code ${exitCode}`);
        }
        if (added.length > 0) {
          addMessage('info', ['npm install ' + added.join(' ') + '...']);
          const { exit } = await runCommand(
            'npm',
            ['install', '--no-progress', ...added],
            (out) => {
              const clean = out
                .replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '')
                .trim();
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean]);
            },
          );
          const exitCode = await exit;
          if (exitCode !== 0)
            throw new Error(`npm install failed with code ${exitCode}`);
        }
      } catch (error) {
        console.error('Package management failed:', error);
        addMessage('error', [
          'Package manager error: ' + (error as Error).message,
        ]);
      } finally {
        updateBusyState(false);
      }
    };

    installQueue.current = installQueue.current.then(performChanges);
  }, [installedPackages, addMessage, updateBusyState]);

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
  };
}
