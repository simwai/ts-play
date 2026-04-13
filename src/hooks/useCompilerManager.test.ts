import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCompilerManager } from './useCompilerManager'
import * as webContainerModule from '../lib/webcontainer'
import { workerClient } from '../lib/workerClient'
import { ok, err } from 'neverthrow'

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
        pipeTo: vi.fn(),
      },
    },
  }),
}))

vi.mock('../lib/workerClient', () => ({
  workerClient: {
    init: vi.fn(),
    compile: vi.fn(),
  },
}))

describe('useCompilerManager', () => {
  const addMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with loading status', async () => {
    let resolveInit: any;
    const initPromise = new Promise((resolve) => { resolveInit = resolve; });
    vi.mocked(workerClient.init).mockResolvedValue(initPromise as any);

    const { result } = renderHook(() => useCompilerManager('code', addMessage))

    expect(result.current.compilerStatus).toBe('loading')

    await act(async () => {
        resolveInit(ok(undefined));
        await new Promise(r => setTimeout(r, 0));
    })

    expect(result.current.compilerStatus).toBe('ready')
  })

  it('should run code and update status', async () => {
    vi.mocked(workerClient.init).mockResolvedValue(ok(undefined) as any);
    vi.mocked(workerClient.compile).mockResolvedValue(ok({ js: 'console.log("hello")', dts: '' }) as any);

    const { result } = renderHook(() =>
      useCompilerManager('console.log("hi")', addMessage)
    )

    // Wait for worker init
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    expect(result.current.compilerStatus).toBe('ready')

    const onSuccess = vi.fn()
    const onError = vi.fn()

    await act(async () => {
      await result.current.runCode(Promise.resolve(), onSuccess, onError)
    })

    expect(workerClient.compile).toHaveBeenCalledWith('console.log("hi")')
    expect(webContainerModule.writeFiles).toHaveBeenCalled()
    expect(webContainerModule.runCommand).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
    expect(result.current.compilerStatus).toBe('ready')
  })

  it('should handle compilation errors', async () => {
    vi.mocked(workerClient.init).mockResolvedValue(ok(undefined) as any);
    const error = new Error('Compile failed')
    vi.mocked(workerClient.compile).mockResolvedValue(err(error) as any);

    const { result } = renderHook(() =>
      useCompilerManager('invalid', addMessage)
    )

    // Wait for worker init
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })

    const onSuccess = vi.fn()
    const onError = vi.fn()

    await act(async () => {
      await result.current.runCode(Promise.resolve(), onSuccess, onError)
    })

    expect(onError).toHaveBeenCalledWith(error)
    expect(result.current.compilerStatus).toBe('error')
  })
})
