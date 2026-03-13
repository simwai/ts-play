import type { TSDiagnostic } from '../hooks/useTSDiagnostics';
import type { TypeInfo } from '../hooks/useTypeInfo';

class WorkerClient {
  private worker: Worker | null = null;
  private resolves = new Map<number, { resolve: Function, reject: Function }>();
  private msgId = 0;

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, success, payload, error } = e.data;
        const p = this.resolves.get(id);
        if (p) {
          this.resolves.delete(id);
          if (success) p.resolve(payload);
          else p.reject(new Error(error));
        }
      };
      this.worker.onerror = (e) => {
        console.error("Worker execution error:", e.message || 'Unknown worker error');
      };
    }
    return this.worker;
  }

  private send<T>(type: string, payload?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.resolves.set(id, { resolve, reject });
      this.getWorker().postMessage({ id, type, payload });
    });
  }

  init() { 
    return this.send<void>('INIT'); 
  }
  
  updateFile(filename: string, content: string) { 
    return this.send<void>('UPDATE_FILE', { filename, content }); 
  }
  
  updateExtraLibs(libs: Record<string, string>) { 
    return this.send<void>('UPDATE_EXTRA_LIBS', { libs }); 
  }

  updateConfig(tsconfig: string) {
    return this.send<void>('UPDATE_CONFIG', { tsconfig });
  }
  
  getDiagnostics() { 
    return this.send<TSDiagnostic[]>('GET_DIAGNOSTICS'); 
  }
  
  getTypeInfo(offset: number) { 
    return this.send<TypeInfo | null>('GET_TYPE_INFO', { offset }); 
  }

  getCompletions(offset: number) {
    return this.send<any[]>('GET_COMPLETIONS', { offset });
  }
  
  compile(code: string) { 
    return this.send<{js: string, dts: string}>('COMPILE', { code }); 
  }
  
  detectImports(code: string) { 
    return this.send<string[]>('DETECT_IMPORTS', { code }); 
  }
}

export const workerClient = new WorkerClient();
