import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebContainerService } from './webcontainer'
import { WebContainer } from '@webcontainer/api'

vi.mock('@webcontainer/api', () => ({
  WebContainer: {
    boot: vi.fn().mockResolvedValue({
      export: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      on: vi.fn(),
      fs: {
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
      spawn: vi.fn().mockResolvedValue({
        exit: Promise.resolve(0),
        output: {
          getReader: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
            releaseLock: vi.fn(),
          }),
        },
      }),
    }),
  },
}))

describe('WebContainerService', () => {
  let service: WebContainerService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new WebContainerService()
  })

  it('exportSnapshot should call export with binary format', async () => {
    const result = await service.exportSnapshot()

    if (result.isErr()) {
        throw result.error
    }

    const instanceResult = await service.getInstance()
    if (instanceResult.isErr()) throw instanceResult.error
    const instance = instanceResult.value

    expect(instance.export).toHaveBeenCalledWith('.', { format: 'binary' })
    expect(result.value).toBeInstanceOf(Uint8Array)
    expect(result.value).toEqual(new Uint8Array([1, 2, 3]))
  })
})
