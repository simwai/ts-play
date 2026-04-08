import { ok, err, type Result } from 'neverthrow'
import { type TSDiagnostic, type TypeInfo } from './types'

class WorkerClient {
  private worker: Worker | null = null
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: Error) => void }> = new Map()

  async init(): Promise<Result<void, Error>> {
    if (this.worker) return ok(undefined)
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e) => {
        const { id, success, payload, error } = e.data
        const pending = this.pendingRequests.get(id)
        if (pending) {
          if (success) pending.resolve(payload)
          else pending.reject(new Error(error))
          this.pendingRequests.delete(id)
        }
      }
      return ok(await this.send('INIT', {}))
    } catch (e: any) {
      return err(e)
    }
  }

  private async send(type: string, payload: any): Promise<any> {
    if (!this.worker) throw new Error('Worker not initialized')
    const id = Math.random().toString(36).slice(2, 11)
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.worker!.postMessage({ id, type, payload })
    })
  }

  async updateConfig(tsconfig: string) { return ok(await this.send('UPDATE_CONFIG', { tsconfig })) }
  async getDiagnostics(): Promise<Result<TSDiagnostic[], Error>> { try { return ok(await this.send('GET_DIAGNOSTICS', {})) } catch (e: any) { return err(e) } }
  async compile(code: string): Promise<Result<{ js: string; dts: string }, Error>> { try { return ok(await this.send('COMPILE', { code })) } catch (e: any) { return err(e) } }
  async generateDts(code: string): Promise<Result<string, Error>> { try { const res = await this.send('COMPILE', { code }); return ok(res.dts) } catch (e: any) { return err(e) } }
  async getTypeInfo(path: string, offset: number): Promise<Result<TypeInfo | null, Error>> { try { return ok(await this.send('GET_TYPE_INFO', { path, offset })) } catch (e: any) { return err(e) } }
  async validateConfig(tsconfig: string) { try { return ok(await this.send('VALIDATE_CONFIG', { tsconfig })) } catch (e: any) { return err(e) } }
  async detectImports(code: string) { try { return ok(await this.send('DETECT_IMPORTS', { code })) } catch (e: any) { return err(e) } }
}
export const workerClient = new WorkerClient()
