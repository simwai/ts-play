import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCompilerManager } from './useCompilerManager'
import * as webContainerModule from '../lib/webcontainer'
import { workerClient } from '../lib/workerClient'
import { okAsync } from 'neverthrow'
import { Provider } from 'jotai'
import React from 'react'

vi.mock('../lib/webcontainer', () => ({
  webContainerService: {
    writeFiles: vi.fn(),
    spawnManaged: vi.fn(),
    readFile: vi.fn(),
  },
  writeFiles: vi.fn(),
  runCommand: vi.fn(),
  readFile: vi.fn(),
  SYSTEM_DEPS: [],
}))

vi.mock('../lib/workerClient', () => ({
  workerClient: {
    init: vi.fn(),
    generateDts: vi.fn(),
  },
}))

describe('useCompilerManager', () => {
  const addMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerClient.init).mockReturnValue(okAsync(undefined))
    vi.mocked(workerClient.generateDts).mockReturnValue(okAsync(''))
    vi.mocked(webContainerModule.writeFiles).mockReturnValue(okAsync(undefined))
    vi.mocked(webContainerModule.readFile).mockReturnValue(okAsync(''))
    vi.mocked(webContainerModule.runCommand).mockReturnValue(okAsync({
      exit: Promise.resolve(0),
      kill: vi.fn(),
      output: {
          getReader: () => ({
              read: () => Promise.resolve({ done: true }),
              releaseLock: () => {}
          })
      }
    } as any))
  })

  it('should initialize successfully', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(Provider, null, children)
    )

    const { result } = renderHook(() => useCompilerManager('code', addMessage), { wrapper })

    await act(async () => {
        await new Promise(r => setTimeout(r, 100))
    })

    // We can't easily check the atom state from here without more setup,
    // but we can check if it doesn't crash and the worker is called.
    expect(workerClient.init).toHaveBeenCalled()
  })
})
