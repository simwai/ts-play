import { ResultAsync } from 'neverthrow'
import type { TSDiagnostic, TypeInfo } from './types'

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

  private send<T>(type: string, payload?: any): ResultAsync<T, Error> {
    return ResultAsync.fromPromise(
      new Promise<T>((resolve, reject) => {
        const id = ++this.msgId

        // Timeout to prevent memory leaks if the worker hangs
        const timeoutId = setTimeout(() => {
          this.resolves.delete(id)
          reject(new Error(`Worker request '${type}' timed out after 15s`))
        }, 15_000)

        this.resolves.set(id, { resolve, reject, timeoutId })
        this.getWorker().postMessage({ id, type, payload })
      }),
      (e) => e as Error
    )
  }

  init(): ResultAsync<void, Error> {
    return this.send<void>('INIT')
  }

  updateFile(filename: string, content: string): ResultAsync<void, Error> {
    return this.send<void>('UPDATE_FILE', { filename, content })
  }

  updateExtraLibs(libs: Record<string, string>): ResultAsync<void, Error> {
    return this.send<void>('UPDATE_EXTRA_LIBS', { libs })
  }

  updateConfig(tsconfig: string): ResultAsync<void, Error> {
    return this.send<void>('UPDATE_CONFIG', { tsconfig })
  }

  validateConfig(tsconfig: string): ResultAsync<{ valid: boolean; error?: string }, Error> {
    return this.send<{ valid: boolean; error?: string }>('VALIDATE_CONFIG', {
      tsconfig,
    })
  }

  getDiagnostics(): ResultAsync<TSDiagnostic[], Error> {
    return this.send<TSDiagnostic[]>('GET_DIAGNOSTICS')
  }

  getTypeInfo(offset: number): ResultAsync<TypeInfo | undefined, Error> {
    return this.send<TypeInfo | undefined>('GET_TYPE_INFO', { offset })
  }

  getCompletions(offset: number): ResultAsync<any[], Error> {
    return this.send<any[]>('GET_COMPLETIONS', { offset })
  }

  generateDts(code: string): ResultAsync<string, Error> {
    return this.send<string>('GENERATE_DTS', { code })
  }

  detectImports(code: string): ResultAsync<string[], Error> {
    return this.send<string[]>('DETECT_IMPORTS', { code })
  }
}

export const workerClient = new WorkerClient()
