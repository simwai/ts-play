import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

export const SYSTEM_DEPS = ['esbuild', 'prettier', 'typescript'];

export type EnvironmentStatus =
  | 'uninitialized' | 'booting' | 'preparing' | 'starting_compiler' | 'ready' | 'error';

export interface SystemLog {
  type: 'info' | 'error' | 'log';
  message: string;
  ts: number;
}

/**
 * Core system dependencies that are required for the playground to function.
 * These are managed by the system and protected from user-level uninstalls.
 * Replacing vite-node with tsx for better stability in the WebContainer.
 */
export const SYSTEM_DEPS = [
  'tsx',
  'esbuild',
  'prettier',
  'typescript',
];

/**
 * WebContainerService encapsulates the WebContainer runtime.
 * It provides a singleton interface for filesystem and process management,
 * ensuring that the environment is correctly initialized and protected.
 *
 * Added a centralized queue for all operations to ensure they run in order
 * and wait for environment readiness.
 */
class WebContainerService {
  private instance: WebContainer | null = null;
  private status: EnvironmentStatus = 'uninitialized';
  private bootPromise: Promise<WebContainer> | null = null;
  private envReadyPromise: Promise<void> | null = null;
  private envReadyResolve: (() => void) | null = null;
  private operationQueue: Promise<any> = Promise.resolve();

  /**
   * Boots the WebContainer if not already initialized.
   */
  public async getInstance(): Promise<WebContainer> {
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

  private fsVersion = 0;
  private builtVersion = -1;
  private buildPromise: Promise<void> | null = null;
  private buildResolve: (() => void) | null = null;

  private envReadyResolve: (() => void) | null = null;
  private envReadyPromise: Promise<void> = new Promise((resolve) => {
    this.envReadyResolve = resolve;
  });

  public getStatus() { return this.status; }
  public setStatus(status: EnvironmentStatus) {
    this.status = status;
    this.statusListeners.forEach(l => l(status));
  }
  public onStatusChange(l: (s: EnvironmentStatus) => void) {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }
  public onLog(l: (log: SystemLog) => void) {
    this.logListeners.add(l);
    return () => this.logListeners.delete(l);
  }
  public emitLog(type: SystemLog['type'], message: string) {
    this.logListeners.forEach(l => l({ type, message, ts: Date.now() }));
  }

  public notifyBuildStart() {
    if (!this.buildPromise) {
      this.buildPromise = new Promise((resolve) => {
        this.buildResolve = resolve;
      });
    }
  }

  public notifyBuildComplete() {
    this.builtVersion = this.fsVersion;
    if (this.buildResolve) {
      this.buildResolve();
      this.buildResolve = null;
      this.buildPromise = null;
    }
  }

  /**
   * Enqueues an operation to be executed sequentially.
   * Ensures the environment is ready before running the operation.
   */
  public async enqueue<T>(operation: (instance: WebContainer) => Promise<T>): Promise<T> {
    const task = async () => {
      await this.getEnvReady();
      const instance = await this.getInstance();
      return await operation(instance);
    };

    const nextOp = this.operationQueue.then(task, task); // Always continue the queue even on failure
    this.operationQueue = nextOp;
    return nextOp;
  }

  /**
   * Special enqueue for system initialization tasks that don't wait for envReady.
   */
  public async enqueueSystem<T>(operation: (instance: WebContainer) => Promise<T>): Promise<T> {
    const task = async () => {
      const instance = await this.getInstance();
      return await operation(instance);
    };

    const nextOp = this.operationQueue.then(task, task);
    this.operationQueue = nextOp;
    return nextOp;
  }

  public async writeFile(path: string, content: string): Promise<void> {
    const wc = await this.getInstance();
    await wc.fs.writeFile(path, content);
  }

  public async enqueue<T>(op: (i: WebContainer) => Promise<T>, wait = true): Promise<T> {
    const task = async () => {
      if (wait) await this.envReadyPromise;
      return op(await this.getInstance());
    };
    const next = this.operationQueue.then(task, task);
    this.operationQueue = next;
    return next;
  }

  public async getInstance() {
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;
    this.setStatus('booting');
    this.emitLog('info', 'Initialising WebContainer...');
    return this.bootPromise = WebContainer.boot().then(i => {
      this.instance = i;
      return i;
    }).catch(e => {
      this.setStatus('error');
      this.emitLog('error', `VM Boot failed: ${e.message}`);
      throw e;
    });
  }

  public markEnvReady() {
    this.setStatus('ready');
    if (this.envReadyResolve) { this.envReadyResolve(); this.envReadyResolve = null; }
  }

  /**
   * Spawns a process and pipes output to the provided callback.
   */
  public async spawnManaged(cmd: string, args: string[], opts: { onLog?: (l: string) => void; silent?: boolean } = {}) {
    const wc = await this.getInstance();
    const proc = await wc.spawn(cmd, args);
    let buffer = '';

    const flush = (isClosing = false) => {
      // Incomplete escape sequence check
      if (!isClosing && (buffer.endsWith('\x1b') || buffer.match(/\x1b\[[0-9;]*$/))) {
        return;
      }

      const lines = buffer.split('\n');
      if (!isClosing) {
        buffer = lines.pop() || '';
      } else {
        buffer = '';
      }
      for (const line of lines) {
        const clean = cleanANSI(line).trim();
        // Ignore solitary junk characters or spinners
        if (clean && !/^[/\\|\-.]$/.test(clean)) {
          if (opts.onLog) opts.onLog(clean);
          if (!opts.silent) this.emitLog('log', clean);
        }
      }
    };

    proc.output.pipeTo(new WritableStream({
      write(d) {
        buffer += d;
        flush(false);
      },
      close() { flush(true); }
    }));
    return { exit: proc.exit, process: proc };
  }

  /**
   * Recursively reads a directory.
   */
  public async readDirRecursive(
    dir: string,
    filter: (path: string) => boolean = () => true,
    basePath: string = dir
  ): Promise<Record<string, string>> {
    const wc = await this.getInstance();
    let entries;
    try { entries = await wc.fs.readdir(dir, { withFileTypes: true }); } catch { return {}; }
    const results: Record<string, string> = {};
    for (const e of entries) {
      const full = `${dir}/${e.name}`;
      const rel = full.replace(new RegExp(`^${base}/?`), '');
      if (e.isDirectory()) Object.assign(results, await this.readDirRecursive(full, filter, base));
      else if (filter(full)) { try { results[rel] = await wc.fs.readFile(full, 'utf8'); } catch {} }
    }
    return results;
  }
}

export const webContainerService = new WebContainerService();

// Re-export old names for legacy support
export const getWebContainer = () => webContainerService.getInstance();
