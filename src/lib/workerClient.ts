import type { TSDiagnostic } from '../hooks/useTSDiagnostics'
import type { TypeInfo } from '../hooks/useTypeInfo'

class WorkerClient {
  private worker: Worker | undefined
  private readonly resolves = new Map<
    number,
    {
      resolve: Function
      reject: Function
      timeoutId: ReturnType<typeof setTimeout>
    }
  >()

  private msgId = 0

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = (e) => {
        const { id, success, payload, error } = e.data
        const p = this.resolves.get(id)
        if (p) {
          clearTimeout(p.timeoutId)
          this.resolves.delete(id)
          if (success) p.resolve(payload)
          else p.reject(new Error(error))
        }
      }

      this.worker.onerror = (e) => {
        console.error(
          'Worker execution error:',
          e.message || 'Unknown worker error'
        )
      }
    }

    return this.worker
  }

  private async send<T>(type: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId

      // Timeout to prevent memory leaks if the worker hangs
      const timeoutId = setTimeout(() => {
        this.resolves.delete(id)
        reject(new Error(`Worker request '${type}' timed out after 15s`))
      }, 15_000)

      this.resolves.set(id, { resolve, reject, timeoutId })
      this.getWorker().postMessage({ id, type, payload })
    })
  }

  async init() {
    return this.send<void>('INIT')
  }

  async updateFile(filename: string, content: string) {
    return this.send<void>('UPDATE_FILE', { filename, content })
  }

  async updateExtraLibs(libs: Record<string, string>) {
    return this.send<void>('UPDATE_EXTRA_LIBS', { libs })
  }

  async updateConfig(tsconfig: string) {
    return this.send<void>('UPDATE_CONFIG', { tsconfig })
  }

  async getDiagnostics() {
    return this.send<TSDiagnostic[]>('GET_DIAGNOSTICS')
  }

  async getTypeInfo(offset: number) {
    return this.send<TypeInfo | undefined>('GET_TYPE_INFO', { offset })
  }

  async getCompletions(offset: number) {
    return this.send<any[]>('GET_COMPLETIONS', { offset })
  }

  async compile(code: string) {
    return this.send<{ js: string; dts: string }>('COMPILE', { code })
  }

  async detectImports(code: string) {
    return this.send<string[]>('DETECT_IMPORTS', { code })
  }
}

export const workerClient = new WorkerClient()
