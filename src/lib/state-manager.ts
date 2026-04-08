import { PlaygroundConfig, ConsoleMessage, InstalledPackage, ToastMessage, ToastType, CompilerStatus } from './types'

export type PlaygroundState = {
  config: PlaygroundConfig
  messages: ConsoleMessage[]
  installedPackages: InstalledPackage[]
  toasts: ToastMessage[]
  compilerStatus?: CompilerStatus
}

type Listener = (state: PlaygroundState) => void

const initialState: PlaygroundState = {
  config: {
    theme: 'github-dark',
    themeMode: 'dark',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    showLineNumbers: true,
    minimap: true,
  },
  messages: [],
  installedPackages: [],
  toasts: [],
}

class PlaygroundStore {
  private state: PlaygroundState = initialState
  private listeners: Set<Listener> = new Set()

  getState() {
    return this.state
  }

  setState(updater: Partial<PlaygroundState> | ((state: PlaygroundState) => Partial<PlaygroundState>)) {
    const nextState = typeof updater === 'function' ? updater(this.state) : updater
    this.state = { ...this.state, ...nextState }
    this.listeners.forEach((l) => l(this.state))
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  addToast(type: ToastType, message: string) {
    const id = Math.random().toString(36).slice(2)
    this.setState((s) => ({
      toasts: [...s.toasts, { id, type, message }],
    }))
    setTimeout(() => this.removeToast(id), 5000)
  }

  removeToast(id: string) {
    this.setState((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }))
  }

  async enqueue<T>(name: string, task: () => Promise<T>): Promise<T> {
    return task()
  }
}

export const playgroundStore = new PlaygroundStore()
