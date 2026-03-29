import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebContainerService } from './webcontainer';

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue({
      export: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      on: vi.fn(),
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
});
