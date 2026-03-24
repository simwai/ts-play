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
 * Robust ANSI stripper.
 * Handles fragmented CSI sequences and carriage returns.
 */
export function cleanANSI(text: string): string {
  if (!text) return '';
  const segments = text.split('\r');
  let result = segments[segments.length - 1];

  // Standard ANSI CSI sequences: ESC [ <params> <cmd>
  result = result.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

  // Strip non-printable ASCII
  result = result.replace(/[^\x20-\x7E\x09\x0A\x0D]/g, '');

  return result;
}

/**
 * Managed WebContainer Environment.
 * Centralized state machine for VM lifecycle and build integrity.
 */
class WebContainerService {
  private instance: WebContainer | null = null;
  private status: EnvironmentStatus = 'uninitialized';
  private bootPromise: Promise<WebContainer> | null = null;
  private operationQueue: Promise<any> = Promise.resolve();

  private statusListeners = new Set<(status: EnvironmentStatus) => void>();
  private logListeners = new Set<(log: SystemLog) => void>();

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

  public async waitForBuild(timeout = 15000) {
    const start = Date.now();
    while (this.builtVersion < this.fsVersion) {
      if (Date.now() - start > timeout) break;
      if (this.buildPromise) {
        await Promise.race([this.buildPromise, new Promise(r => setTimeout(r, 500))]);
      } else {
        await new Promise(r => setTimeout(r, 100));
      }
    }
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
   * Spawns a process with managed output handling.
   * Prevents fragmented ANSI leaks and terminal noise.
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

  public async writeFile(path: string, content: string) {
    this.fsVersion++;
    await (await this.getInstance()).fs.writeFile(path, content);
  }

  public async readFile(path: string) {
    return await (await this.getInstance()).fs.readFile(path, 'utf8');
  }

  public async readDirRecursive(dir: string, filter: (p: string) => boolean = () => true, base = dir): Promise<Record<string, string>> {
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
export const getWebContainer = () => webContainerService.getInstance();
