export type PackageManagerStatus = 'idle' | 'installing' | 'uninstalling' | 'syncing' | 'error'
export type EnvironmentStatus = 'idle' | 'booting' | 'preparing' | 'ready' | 'error'
export type CompilerStatus = 'Idle' | 'Preparing' | 'Running' | 'Compiling' | 'Ready' | 'Error'
import type { ThemeMode } from './theme'

export interface PlaygroundState {
  lifecycle: EnvironmentStatus
  tscStatus: CompilerStatus
  esbuildStatus: CompilerStatus
  packageManagerStatus: PackageManagerStatus
  theme: ThemeMode
  lineWrap: boolean
  stripAnsi: boolean
  inlineDeps: boolean
  isReady: boolean
  bootTime: number | null
}

type StateListener = (state: PlaygroundState) => void

class PlaygroundStore {
  private state: PlaygroundState = {
    lifecycle: 'idle',
    tscStatus: 'Idle',
    esbuildStatus: 'Idle',
    packageManagerStatus: 'idle',
    theme: (localStorage.getItem('tsplay_theme') as ThemeMode) || 'mocha',
    lineWrap: localStorage.getItem('tsplay_linewrap') === 'true',
    stripAnsi: localStorage.getItem('tsplay_stripansi') === 'true',
    inlineDeps: localStorage.getItem('tsplay_inlinedeps') === 'true',
    isReady: false,
    bootTime: null,
  }

  private listeners: Set<StateListener> = new Set()
  private operationQueue: Promise<any> = Promise.resolve()

  getState(): PlaygroundState {
    return { ...this.state }
  }

  setState(
    patch: Partial<PlaygroundState> | ((prev: PlaygroundState) => Partial<PlaygroundState>),
  ) {
    const oldReady = this.state.isReady
    const resolvedPatch = typeof patch === 'function' ? patch(this.state) : patch

    this.state = { ...this.state, ...resolvedPatch }

    // Persistence
    if (resolvedPatch.theme) localStorage.setItem('tsplay_theme', resolvedPatch.theme)
    if (resolvedPatch.lineWrap !== undefined)
      localStorage.setItem('tsplay_linewrap', String(resolvedPatch.lineWrap))
    if (resolvedPatch.stripAnsi !== undefined)
      localStorage.setItem('tsplay_stripansi', String(resolvedPatch.stripAnsi))
    if (resolvedPatch.inlineDeps !== undefined)
      localStorage.setItem('tsplay_inlinedeps', String(resolvedPatch.inlineDeps))

    // Derive readiness
    this.state.isReady =
      this.state.lifecycle === 'ready' &&
      this.state.tscStatus === 'Ready' &&
      this.state.esbuildStatus === 'Ready'

    this.notify()
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const snapshot = { ...this.state }
    this.listeners.forEach((l) => l(snapshot))
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.operationQueue = this.operationQueue.then(task)
    return this.operationQueue
  }
}

export const playgroundStore = new PlaygroundStore()
