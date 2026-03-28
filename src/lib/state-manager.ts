import { type ThemeMode } from './theme'
import {
  type CompilerStatus,
  type PackageManagerStatus,
  type ToastMessage,
  type ToastType,
} from './types'

export interface PlaygroundState {
  theme: ThemeMode
  tsCode: string
  jsCode: string
  dtsCode: string
  tsConfigString: string
  trueColorEnabled: boolean
  lineWrap: boolean
  compilerStatus: CompilerStatus
  packageManagerStatus: PackageManagerStatus
  toasts: ToastMessage[]
}

type Listener = (state: PlaygroundState) => void

class PlaygroundStore {
  private state: PlaygroundState = {
    theme: 'mocha',
    tsCode: '',
    jsCode: '',
    dtsCode: '',
    tsConfigString: '',
    trueColorEnabled: true,
    lineWrap: true,
    compilerStatus: 'loading',
    packageManagerStatus: 'idle',
    toasts: [],
  }

  private listeners = new Set<Listener>()

  getState() {
    return this.state
  }

  setState(
    update:
      | Partial<PlaygroundState>
      | ((prev: PlaygroundState) => Partial<PlaygroundState>)
  ) {
    const nextState = typeof update === 'function' ? update(this.state) : update
    this.state = { ...this.state, ...nextState }
    this.listeners.forEach((l) => l(this.state))
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addToast(type: ToastType, message: string) {
    const id = Math.random().toString(36).substring(2, 9)
    this.setState((prev) => ({
      toasts: [...prev.toasts, { id, type, message }],
    }))
    return id
  }

  removeToast(id: string) {
    this.setState((prev) => ({
      toasts: prev.toasts.filter((t) => t.id !== id),
    }))
  }

  enqueue(actionName: string, action: () => Promise<void>) {
    this.addToast('info', `Action queued: ${actionName}`)
    return action()
  }
}

export const playgroundStore = new PlaygroundStore()
