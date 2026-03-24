import { useState, useCallback, useMemo, useEffect } from 'react';
import { webContainerService, type CompilerStatus } from '../lib/webcontainer';

export function useCompilerManager() {
  const [isRunning, setIsRunning] = useState(false);
  const [tscStatus, setTscStatus] = useState<CompilerStatus>(webContainerService.tscStatus);
  const [parcelStatus, setParcelStatus] = useState<CompilerStatus>(webContainerService.parcelStatus);

  useEffect(() => {
    return webContainerService.onCompilerStatus(() => {
      setTscStatus(webContainerService.tscStatus);
      setParcelStatus(webContainerService.parcelStatus);
    });
  }, []);

  const statusText = useMemo(() => {
    const parts = [];
    if (tscStatus === 'Running' || tscStatus === 'Compiling') parts.push('TS...');
    else if (tscStatus === 'Ready') parts.push('TS Ready');
    else if (tscStatus === 'Preparing') parts.push('TS Prep');
    else if (tscStatus === 'Error') parts.push('TS Error');

    if (parcelStatus === 'Running' || parcelStatus === 'Compiling') parts.push('JS...');
    else if (parcelStatus === 'Ready') parts.push('JS Ready');
    else if (parcelStatus === 'Preparing') parts.push('JS Prep');
    else if (parcelStatus === 'Error') parts.push('JS Error');

    return parts.join(' | ') || 'Idle';
  }, [tscStatus, parcelStatus]);

  const runCode = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      await webContainerService.waitForBuild();
      const proc = await webContainerService.spawnManaged('node', ['dist/index.js']);
      await proc.exit;
    } catch (err: any) {
      console.error('Execution Error:', err);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (parcelStatus === 'Ready') {
      runCode();
    }
  }, [parcelStatus, runCode]);

  return {
    statusText,
    runCode,
    isRunning,
  };
}
