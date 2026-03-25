import { useState, useCallback } from 'react';
import { webContainerService } from '../lib/webcontainer';
import { usePlaygroundStore } from './usePlaygroundStore';
import { db } from '../lib/db';

export function useCompilerManager() {
  const [isRunning, setIsRunning] = useState(false);
  const { isReady } = usePlaygroundStore();

  const runCode = useCallback(async () => {
    if (isRunning || !isReady) return;

    setIsRunning(true);
    try {
      const proc = await webContainerService.spawnManaged('node', ['dist/index.js']);
      const exitCode = await proc.exit;
      if (exitCode === 0) {
        // Successful execution - capture snapshot
        try {
          const snapshot = await webContainerService.exportSnapshot();
          await db.saveSnapshot('playground', snapshot);
          webContainerService.emitLog('info', '✨ Environment snapshot saved to IndexedDB.');
        } catch (err: any) {
          console.error('Failed to save snapshot:', err);
        }
      } else {
        webContainerService.emitLog('error', `Process exited with code ${exitCode}`);
      }
    } catch (err: any) {
      webContainerService.emitLog('error', `Execution Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, isReady]);

  return {
    runCode,
    isRunning,
  };
}
