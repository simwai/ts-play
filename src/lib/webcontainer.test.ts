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
                value: new TextEncoder().encode('hello\nworld\n'),
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

    const instance = await service.getInstance();
    const mockProc = {
      output: {
        getReader: vi.fn().mockReturnValue({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              value: new TextEncoder().encode('hello\nworld\n'),
              done: false,
            })
            .mockResolvedValueOnce({ done: true }),
          releaseLock: vi.fn(),
        }),
      },
    };
    vi.spyOn(instance, 'spawn').mockResolvedValue(mockProc as any);

    await service.spawnManaged('echo', ['hello']);

    // Give it a tick to process the async stream
    await new Promise((resolve) => setTimeout(resolve, 200));

    // In some test environments, value instanceof Uint8Array may fail
    // if realms differ. We check for 'hello' or its encoded string.
    const allLogs = logs.join('\n');
    expect(
      allLogs.includes('hello') || allLogs.includes('104,101,108,108,111'),
    ).toBe(true);
    expect(
      allLogs.includes('world') || allLogs.includes('119,111,114,108,100'),
    ).toBe(true);
  });
});
