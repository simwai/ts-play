import { toErrorMessage } from './errors'
import type {
  CustomMessageType,
  CustomMessagePayload,
  CustomMessageResponse,
} from './workerProtocol'

class WorkerClient {
  private worker: Worker | undefined
  private readonly resolves = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (reason?: unknown) => void
      timeoutId: ReturnType<typeof setTimeout>
    }
  >()

  private msgId = 0

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = (e: MessageEvent) => {
        const { id, success, payload, error, protocol } = e.data
        if (protocol && protocol !== 'custom') return
        const p = this.resolves.get(id)
        if (p) {
          clearTimeout(p.timeoutId)
          this.resolves.delete(id)
          if (success) p.resolve(payload)
          else p.reject(new Error(error))
        }
      }

      this.worker.onerror = (e) => {
        const msg = toErrorMessage(e.message || 'Unknown worker error')
        // Worker errors are critical - log to console for debugging
        // but avoid spamming in production
        console.error('Worker execution error:', msg)
      }
    }

    return this.worker
  }

  private async send<T>(
    type: CustomMessageType,
    payload?: CustomMessagePayload
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId

      // Timeout to prevent memory leaks if the worker hangs
      const timeoutId = setTimeout(() => {
        this.resolves.delete(id)
        reject(new Error(`Worker request '${type}' timed out after 15s`))
      }, 15_000)

      this.resolves.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeoutId,
      })
      this.getWorker().postMessage({ id, type, payload })
    })
  }

  async init(): Promise<void> {
    return this.send<void>('INIT')
  }

  async updateFile(filename: string, content: string): Promise<void> {
    return this.send<void>('UPDATE_FILE', {
      type: 'UPDATE_FILE',
      filename,
      content,
    })
  }

  async updateConfig(tsconfig: string): Promise<void> {
    return this.send<void>('UPDATE_CONFIG', { type: 'UPDATE_CONFIG', tsconfig })
  }

  async validateConfig(tsconfig: string): Promise<{
    valid: boolean
    error?: string
  }> {
    return this.send<{ valid: boolean; error?: string }>('VALIDATE_CONFIG', {
      type: 'VALIDATE_CONFIG',
      tsconfig,
    })
  }

  async compile(code: string): Promise<{ js: string; dts: string }> {
    return this.send<{ js: string; dts: string }>('COMPILE', {
      type: 'COMPILE',
      code,
    })
  }

  async detectImports(code: string): Promise<string[]> {
    return this.send<string[]>('DETECT_IMPORTS', {
      type: 'DETECT_IMPORTS',
      code,
    })
  }
}

export const workerClient = new WorkerClient()
