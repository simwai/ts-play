import type { ThemeMode } from './theme'
import type {
  CompilerStatus,
  PackageManagerStatus,
  ToastMessage,
  ToastType,
  EnvironmentStatus,
} from './types'

export type { CompilerStatus, PackageManagerStatus, ToastMessage, ToastType, EnvironmentStatus }

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
  lifecycle: EnvironmentStatus
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
    lifecycle: 'idle',
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

  enqueue<T>(actionName: string, action: () => Promise<T>): Promise<T>
  enqueue<T>(action: () => Promise<T>): Promise<T>
  enqueue<T>(arg1: string | (() => Promise<T>), arg2?: () => Promise<T>): Promise<T> {
    const actionName = typeof arg1 === 'string' ? arg1 : 'Action'
    const action = typeof arg1 === 'function' ? arg1 : arg2!

    this.addToast('info', `Action queued: ${actionName}`)
    return action()
  }
}

export const playgroundStore = new PlaygroundStore()
