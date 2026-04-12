import { describe, it, expect, vi, beforeEach } from 'vitest'
import { webContainerService } from './webcontainer'

vi.mock('@webcontainer/api', () => {
  return {
    WebContainer: {
      boot: vi.fn().mockResolvedValue({
        fs: {
          writeFile: vi.fn().mockResolvedValue(undefined),
          readFile: vi.fn().mockResolvedValue('content'),
          mkdir: vi.fn().mockResolvedValue(undefined),
          readdir: vi.fn().mockResolvedValue([]),
        },
        spawn: vi.fn().mockResolvedValue({
          output: {
            getReader: () => ({
              read: vi.fn().mockResolvedValue({ done: true }),
              releaseLock: vi.fn(),
            }),
            pipeTo: vi.fn().mockResolvedValue(undefined),
          },
          exit: Promise.resolve(0),
        }),
        on: vi.fn(),
      }),
    },
  }
})

describe('WebContainerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should boot and return instance', async () => {
    const result = await webContainerService.getInstance()
    expect(result.isOk()).toBe(true)
  })

  it('should write files', async () => {
    const result = await webContainerService.writeFile('test.ts', 'const a = 1')
    expect(result.isOk()).toBe(true)
  })

  it('should read files', async () => {
    const result = await webContainerService.readFile('test.ts')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('content')
    }
  })
})
