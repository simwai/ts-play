import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

export type EnvironmentStatus = 'booting' | 'preparing' | 'ready' | 'error';
export type CompilerStatus = 'Idle' | 'Preparing' | 'Running' | 'Compiling' | 'Ready' | 'Error';

export const SYSTEM_DEPS = ['typescript', 'esbuild', 'prettier', 'lodash-es', '@types/lodash-es'];

export class WebContainerService {
  private instance: WebContainer | null = null;
  private status: EnvironmentStatus = 'booting';
  private queue: Promise<any> = Promise.resolve();
  private buildPromise: Promise<void> | null = null;
  private buildResolver: (() => void) | null = null;

  private logCallbacks: Set<(log: { type: string; message: string }) => void> = new Set();
  private statusCallbacks: Set<(status: EnvironmentStatus) => void> = new Set();

  public tscStatus: CompilerStatus = 'Idle';
  public parcelStatus: CompilerStatus = 'Idle';
  private compilerCallbacks: Set<() => void> = new Set();

  async getInstance(): Promise<WebContainer> {
    if (!this.instance) {
      console.log("[Service] Booting WebContainer...");
      this.instance = await WebContainer.boot();
      console.log("[Service] WebContainer Booted.");
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

  onLog(cb: (log: { type: string; message: string }) => void) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  emitLog(type: string, message: string) {
    this.logCallbacks.forEach(cb => cb({ type, message }));
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

  async writeFile(path: string, content: string) {
    const instance = await this.getInstance();
    await instance.fs.writeFile(path, content);
  }

  async spawnManaged(cmd: string, args: string[], options: { silent?: boolean, onLog?: (line: string) => void } = {}): Promise<WebContainerProcess> {
    const instance = await this.getInstance();
    const proc = await instance.spawn(cmd, args);

    proc.output.pipeTo(new WritableStream({
      write: (data) => {
        if (!options.silent) this.emitLog('info', data);
        options.onLog?.(data);
      }
    }));

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
