import type { ThemeMode } from './theme'
import type {
  ToastType,
  ToastMessage,
  PackageManagerStatus,
  CompilerStatus,
} from './types'

export interface PlaygroundState {
  theme: ThemeMode
  tsCode: string
  jsCode: string
  dtsCode: string
  tsConfigString: string
  trueColorEnabled: boolean
  lineWrap: boolean
  showNodeWarnings: boolean
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
    showNodeWarnings: true,
    compilerStatus: 'loading',
    packageManagerStatus: 'idle',
    toasts: [],
  }

  private listeners = new Set<Listener>()
  private queue: Promise<void> = Promise.resolve()

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
    const id = Math.random().toString(36).slice(2, 9)
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

  enqueue<T>(actionName: string, action: () => Promise<T>): Promise<T> {
    const toastId = this.addToast('info', `Action queued: ${actionName}`)

    const promise = this.queue.then(async () => {
      try {
        return await action()
      } finally {
        this.removeToast(toastId)
      }
    })

    this.queue = promise.then(() => {}).catch(() => {})
    return promise
  }
}

export const playgroundStore = new PlaygroundStore()
