import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebContainerService } from './webcontainer';

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue({
      export: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      on: vi.fn(),
      spawn: vi.fn().mockResolvedValue({
        output: {
          getReader: vi.fn().mockReturnValue({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                value: new TextEncoder().encode('hello\nworld'),
                done: false,
              })
              .mockResolvedValueOnce({ done: true }),
            releaseLock: vi.fn(),
          }),
        },
      }),
    }),
  },
}));

describe('WebContainerService', () => {
  let service: WebContainerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebContainerService();
  });

  it('exportSnapshot should call export with binary format', async () => {
    const instance = await service.getInstance();
    const exportSpy = vi.spyOn(instance, 'export');

    const result = await service.exportSnapshot();

    expect(exportSpy).toHaveBeenCalledWith('.', { format: 'binary' });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('spawnManaged should process stream and emit logs', async () => {
    const logs: string[] = [];
    service.onLog((log) => logs.push(log.message));

    await service.spawnManaged('echo', ['hello']);

    // Give it a tick to process the async stream
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logs).toContain('hello');
    expect(logs).toContain('world');
  });
});
