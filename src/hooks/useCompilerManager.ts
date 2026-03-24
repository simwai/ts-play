import { useState, useCallback } from 'react';
import { webContainerService } from '../lib/webcontainer';
import { usePlaygroundStore } from './usePlaygroundStore';

export function useCompilerManager() {
  const [isRunning, setIsRunning] = useState(false);
  const { isReady } = usePlaygroundStore();

  const runCode = useCallback(async () => {
    if (isRunning || !isReady) return;

    setIsRunning(true);
    try {
      // The state-manager already ensures we are 'Ready' before this is enabled
      const proc = await webContainerService.spawnManaged('node', ['dist/index.js']);
      const exitCode = await proc.exit;
      if (exitCode !== 0) {
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
