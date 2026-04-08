import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCompilerManager } from './useCompilerManager'
import { workerClient } from '../lib/workerClient'
import { Provider } from 'jotai'
import React from 'react'

vi.mock('../lib/workerClient', () => ({
  workerClient: {
    init: vi
      .fn()
      .mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: undefined,
        match: (s: any) => s(),
      }),
    updateConfig: vi
      .fn()
      .mockResolvedValue({ isOk: () => true, isErr: () => false }),
    generateDts: vi.fn().mockResolvedValue({ isOk: () => true, value: 'dts' }),
    getDiagnostics: vi.fn().mockResolvedValue({ isOk: () => true, value: [] }),
    validateConfig: vi
      .fn()
      .mockResolvedValue({ isOk: () => true, value: { valid: true } }),
  },
}))

vi.mock('../lib/webcontainer', () => ({
  writeFiles: vi
    .fn()
    .mockResolvedValue({ isOk: () => true, isErr: () => false }),
  runCommand: vi
    .fn()
    .mockResolvedValue({
      isOk: () => true,
      value: { exit: Promise.resolve(0) },
    }),
  readFile: vi.fn().mockResolvedValue({ isOk: () => true, value: 'content' }),
}))

vi.mock('../lib/formatter', () => ({
  loadPrettier: vi.fn().mockResolvedValue(undefined),
  formatAllFiles: vi
    .fn()
    .mockResolvedValue({ ts: '', js: '', dts: '', errors: [] }),
}))

describe('useCompilerManager', () => {
  const addMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize successfully', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, null, children)

    renderHook(() => useCompilerManager('code', addMessage), { wrapper })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })

    expect(workerClient.init).toHaveBeenCalled()
  })
})
