import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webContainerService } from '../lib/webcontainer';
import { useCompilerManager } from './useCompilerManager';

vi.mock('../lib/webcontainer', () => ({
  webContainerService: {
    spawnManaged: vi.fn(),
    exportSnapshot: vi.fn(),
    emitLog: vi.fn(),
  },
}));

vi.mock('../lib/db', () => ({
  db: {
    saveSnapshot: vi.fn(),
  },
}));

vi.mock('./usePlaygroundStore', () => ({
  usePlaygroundStore: () => ({ isReady: true }),
}));

describe('useCompilerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runCode logs error if snapshot export fails', async () => {
    const mockExit = Promise.resolve(0);
    (webContainerService.spawnManaged as any).mockResolvedValue({
      exit: mockExit,
    });
    (webContainerService.exportSnapshot as any).mockRejectedValue(
      new Error('Serialization failed'),
    );

    const { result } = renderHook(() => useCompilerManager());

    await act(async () => {
      await result.current.runCode();
    });

    expect(webContainerService.emitLog).toHaveBeenCalledWith(
      'error',
      'Failed to save snapshot: Serialization failed',
    );
  });
});
