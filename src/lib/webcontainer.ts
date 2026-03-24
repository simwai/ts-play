import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

export type EnvironmentStatus = 'idle' | 'booting' | 'preparing' | 'ready' | 'error';
export type CompilerStatus = 'Idle' | 'Preparing' | 'Running' | 'Compiling' | 'Ready' | 'Error';

export const SYSTEM_DEPS = ['typescript', 'esbuild', 'prettier', 'lodash-es', '@types/lodash-es'];

export class WebContainerService {
  private instance: WebContainer | null = null;
  private status: EnvironmentStatus = 'idle';
  private queue: Promise<any> = Promise.resolve();
  private buildPromise: Promise<void> | null = null;
  private buildResolver: (() => void) | null = null;

  private logCallbacks: Set<(log: { type: string; message: string; timestamp: number }) => void> = new Set();
  private statusCallbacks: Set<(status: EnvironmentStatus) => void> = new Set();

  public tscStatus: CompilerStatus = 'Idle';
  public parcelStatus: CompilerStatus = 'Idle';
  private compilerCallbacks: Set<() => void> = new Set();

  public serverUrl: string | null = null;

  async getInstance(): Promise<WebContainer> {
    if (!this.instance) {
      this.setStatus('booting');
      this.emitLog('info', 'Booting WebContainer...');
      this.instance = await WebContainer.boot();
      this.emitLog('info', 'WebContainer booted.');

      this.instance.on('server-ready', (port, url) => {
        this.serverUrl = url;
        this.emitLog('info', `Server ready: ${url} (port ${port})`);
      });
    }
    return this.instance;
  }

  setStatus(s: EnvironmentStatus) {
    this.status = s;
    this.statusCallbacks.forEach(cb => cb(s));
  }

  setCompilerStatus(type: 'tsc' | 'parcel', status: CompilerStatus) {
    if (type === 'tsc') this.tscStatus = status;
    else this.parcelStatus = status;
    this.compilerCallbacks.forEach(cb => cb());
  }

  onCompilerStatus(cb: () => void) {
    this.compilerCallbacks.add(cb);
    return () => this.compilerCallbacks.delete(cb);
  }

  onStatusChange(cb: (status: EnvironmentStatus) => void) {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  onLog(cb: (log: { type: string; message: string; timestamp: number }) => void) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  emitLog(type: string, message: string) {
    if (!message) return;
    this.logCallbacks.forEach(cb => cb({ type, message, timestamp: Date.now() }));
  }

  async enqueue<T>(task: (instance: WebContainer) => Promise<T>): Promise<T> {
    this.queue = this.queue.then(async () => {
      const instance = await this.getInstance();
      return task(instance);
    });
    return this.queue;
  }

  async mount(files: any) {
    const instance = await this.getInstance();
    await instance.mount(files);
  }

  async mountSnapshot(url: string) {
     this.emitLog('info', `Fetching snapshot from ${url}...`);
     const res = await fetch(url);
     if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
     const buffer = await res.arrayBuffer();
     const instance = await this.getInstance();
     await instance.mount(buffer);
     this.emitLog('info', 'Snapshot mounted successfully.');
  }

  async writeFile(path: string, content: string) {
    const instance = await this.getInstance();
    await instance.fs.writeFile(path, content);
  }

  async readFile(path: string) {
    const instance = await this.getInstance();
    return instance.fs.readFile(path, 'utf8');
  }

  async spawnManaged(cmd: string, args: string[], options: { silent?: boolean, onLog?: (line: string) => void } = {}): Promise<WebContainerProcess> {
    const instance = await this.getInstance();
    const proc = await instance.spawn(cmd, args);

    const reader = proc.output.getReader();
    const decoder = new TextDecoder();
    let currentLineBuffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          let chunk = value;
          if (value instanceof Uint8Array) {
             chunk = decoder.decode(value, { stream: true });
          }

          currentLineBuffer += chunk;
          const lines = currentLineBuffer.split(/\r?\n|\r/);

          const last = lines[lines.length - 1];
          const hasIncompleteAnsi = /[\u001b\u009b][\[\]()#;?]*[0-9;]*$/.test(last);

          if (!hasIncompleteAnsi) {
            currentLineBuffer = lines.pop() || '';
            for (const line of lines) {
               const simplified = line.replace(/\s{5,}/g, '    ');
               if (!options.silent) this.emitLog('info', simplified);
               options.onLog?.(simplified);
            }
          } else {
            const completeLines = lines.slice(0, -1);
            currentLineBuffer = lines[lines.length - 1];
            for (const line of completeLines) {
               const simplified = line.replace(/\s{5,}/g, '    ');
               if (!options.silent) this.emitLog('info', simplified);
               options.onLog?.(simplified);
            }
          }
        }
        if (currentLineBuffer) {
          if (!options.silent) this.emitLog('info', currentLineBuffer);
          options.onLog?.(currentLineBuffer);
        }
      } catch (err: any) {
        console.warn('[WC Service] Stream read error:', err.message);
      } finally {
        reader.releaseLock();
      }
    })();

    return proc;
  }

  notifyBuildStart() {
    if (!this.buildPromise) {
      this.buildPromise = new Promise((resolve) => {
        this.buildResolver = resolve;
      });
    }
  }

  notifyBuildComplete() {
    if (this.buildResolver) {
      this.buildResolver();
      this.buildResolver = null;
      this.buildPromise = null;
    }
  }

  async waitForBuild() {
    if (this.buildPromise) {
      await this.buildPromise;
    }
  }

  markEnvReady() {
    this.setStatus('ready');
  }

  async readDirRecursive(dir: string, filter?: (path: string) => boolean): Promise<Record<string, string>> {
    const instance = await this.getInstance();
    const results: Record<string, string> = {};

    const read = async (currentPath: string) => {
      try {
        const entries = await instance.fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = `${currentPath}/${entry.name}`;
          if (entry.isDirectory()) {
            await read(fullPath);
          } else if (!filter || filter(fullPath)) {
            const content = await instance.fs.readFile(fullPath, 'utf8');
            results[fullPath.replace('node_modules/', '')] = content;
          }
        }
      } catch {}
    };

    await read(dir);
    return results;
  }
}

export const webContainerService = new WebContainerService();
