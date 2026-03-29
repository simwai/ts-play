import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompilerManager } from './useCompilerManager';
import * as webContainerModule from '../lib/webcontainer';
import { workerClient } from '../lib/workerClient';

vi.mock('../lib/webcontainer', () => ({
  webContainerService: {
    writeFiles: vi.fn().mockResolvedValue(undefined),
    spawnManaged: vi.fn().mockResolvedValue({
      exit: Promise.resolve(0),
      kill: vi.fn(),
    }),
  },
  writeFiles: vi.fn().mockResolvedValue(undefined),
  runCommand: vi.fn().mockResolvedValue({
    exit: Promise.resolve(0),
    process: {
      kill: vi.fn(),
      output: {
        pipeTo: vi.fn()
      }
    }
  }),
}));

vi.mock('../lib/workerClient', () => ({
  workerClient: {
    init: vi.fn().mockResolvedValue(undefined),
    compile: vi.fn().mockResolvedValue({ js: 'console.log("hello")', dts: '' }),
  },
}));

describe('useCompilerManager', () => {
  const addMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading status', () => {
    const { result } = renderHook(() => useCompilerManager('code', addMessage));
    expect(result.current.compilerStatus).toBe('loading');
    expect(result.current.isRunning).toBe(false);
  });

  it('should run code and update status', async () => {
    const { result } = renderHook(() => useCompilerManager('console.log("hi")', addMessage));

    // Wait for worker init
    await act(async () => {
       await new Promise(r => setTimeout(r, 10));
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      await result.current.runCode(Promise.resolve(), onSuccess, onError);
    });

    expect(workerClient.compile).toHaveBeenCalledWith('console.log("hi")');
    expect(webContainerModule.writeFiles).toHaveBeenCalled();
    expect(webContainerModule.runCommand).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.compilerStatus).toBe('ready');
  });

  it('should handle compilation errors', async () => {
    const error = new Error('Compile failed');
    vi.mocked(workerClient.compile).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCompilerManager('invalid', addMessage));

    // Wait for worker init
    await act(async () => {
       await new Promise(r => setTimeout(r, 10));
    });

    const onSuccess = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      await result.current.runCode(Promise.resolve(), onSuccess, onError);
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.compilerStatus).toBe('ready'); // finally block sets it back to ready
  });
});
