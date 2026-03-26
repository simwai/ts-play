import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import { playgroundStore } from './state-manager';
import { RegexPatterns, toRegExp } from './regex';
import type { EnvironmentStatus, CompilerStatus } from '../types/status';

export const SYSTEM_DEPS = [
  'typescript',
  'esbuild',
  'prettier',
  'lodash-es',
  '@types/lodash-es',
  '@types/node',
];

export class WebContainerService {
  private instance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private logCallbacks: Set<
    (log: { type: string; message: string; timestamp: number }) => void
  > = new Set();

  public serverUrl: string | null = null;

  async getInstance(): Promise<WebContainer> {
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = (async () => {
      playgroundStore.setState({ lifecycle: 'booting' });
      this.emitLog('info', 'Booting WebContainer...');
      const instance = await WebContainer.boot();
      this.instance = instance;
      this.emitLog('info', 'WebContainer booted.');

      instance.on('server-ready', (port, url) => {
        this.serverUrl = url;
        this.emitLog('info', `Server ready: ${url} (port ${port})`);
      });

      return instance;
    })();

    return this.bootPromise;
  }

  onLog(
    cb: (log: { type: string; message: string; timestamp: number }) => void,
  ) {
    this.logCallbacks.add(cb);
    return () => this.logCallbacks.delete(cb);
  }

  emitLog(type: string, message: string) {
    if (!message) return;
    this.logCallbacks.forEach((cb) =>
      cb({ type, message, timestamp: Date.now() }),
    );
  }

  async enqueue<T>(task: (instance: WebContainer) => Promise<T>): Promise<T> {
    return playgroundStore.enqueue(async () => {
      const instance = await this.getInstance();
      return task(instance);
    });
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
    await instance.mount(new Uint8Array(buffer));
    this.emitLog('info', 'Snapshot mounted successfully.');
  }

  async exportSnapshot(): Promise<Uint8Array> {
    const instance = await this.getInstance();
    this.emitLog('info', 'Exporting environment snapshot...');
    // Use binary format to avoid JSON serialization issues and reduce size
    const snapshot = (await instance.export('.', {
      format: 'binary',
    })) as Uint8Array;
    this.emitLog('info', 'Snapshot exported.');
    return snapshot;
  }

  async mountRawSnapshot(data: Uint8Array) {
    const instance = await this.getInstance();
    await instance.mount(data);
    this.emitLog('info', 'Local snapshot mounted.');
  }

  async writeFile(path: string, content: string) {
    const instance = await this.getInstance();
    await instance.fs.writeFile(path, content);
  }

  async readFile(path: string) {
    const instance = await this.getInstance();
    return instance.fs.readFile(path, 'utf8');
  }

  async getEnvReady() {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (playgroundStore.getState().lifecycle === 'ready') resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  async spawnManaged(
    cmd: string,
    args: string[],
    options: { silent?: boolean; onLog?: (line: string) => void } = {},
  ): Promise<WebContainerProcess> {
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
          const lines = currentLineBuffer.split(
            toRegExp(RegexPatterns.NEWLINE),
          );

          const last = lines[lines.length - 1];
          const hasIncompleteAnsi = toRegExp(
            RegexPatterns.INCOMPLETE_ANSI,
          ).test(last);

          if (!hasIncompleteAnsi) {
            currentLineBuffer = lines.pop() || '';
            for (const line of lines) {
              const simplified = line.replace(
                toRegExp(RegexPatterns.EXCESSIVE_WHITESPACE),
                '    ',
              );
              if (!options.silent) this.emitLog('info', simplified);
              options.onLog?.(simplified);
            }
          } else {
            const completeLines = lines.slice(0, -1);
            currentLineBuffer = lines[lines.length - 1];
            for (const line of completeLines) {
              const simplified = line.replace(
                toRegExp(RegexPatterns.EXCESSIVE_WHITESPACE),
                '    ',
              );
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

  async readDirRecursive(
    dir: string,
    filter?: (path: string) => boolean,
  ): Promise<Record<string, string>> {
    const instance = await this.getInstance();
    const results: Record<string, string> = {};

    const read = async (currentPath: string) => {
      try {
        const entries = await instance.fs.readdir(currentPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const fullPath = `${currentPath}/${entry.name}`;
          if (entry.isDirectory()) {
            await read(fullPath);
          } else if (!filter || filter(fullPath)) {
            const content = await instance.fs.readFile(fullPath, 'utf8');
            // Keep the full path relative to the root for Monaco
            const monacoPath = fullPath.startsWith('./')
              ? fullPath.slice(2)
              : fullPath;
            results[monacoPath] = content;
          }
        }
      } catch {}
    };

    await read(dir);
    return results;
  }
}

export const webContainerService = new WebContainerService();
