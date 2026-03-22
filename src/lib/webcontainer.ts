import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

/**
 * Core system dependencies that are required for the playground to function.
 * These are managed by the system and protected from user-level uninstalls.
 */
export const SYSTEM_DEPS = [
  'vite-node',
  'esbuild',
  'prettier',
  'typescript',
];

/**
 * WebContainerService encapsulates the WebContainer runtime.
 * It provides a singleton interface for filesystem and process management,
 * ensuring that the environment is correctly initialized and protected.
 */
class WebContainerService {
  private instance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private envReadyPromise: Promise<void> | null = null;
  private envReadyResolve: (() => void) | null = null;

  /**
   * Boots the WebContainer if not already initialized.
   * Uses a singleton promise to avoid multiple boot attempts.
   */
  public async getInstance(): Promise<WebContainer> {
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = WebContainer.boot().then((instance) => {
      this.instance = instance;
      return instance;
    });

    return this.bootPromise;
  }

  /**
   * A promise-based lock that resolves when the initial system environment
   * (e.g., npm install of system tools) is complete.
   */
  public getEnvReady(): Promise<void> {
    if (!this.envReadyPromise) {
      this.envReadyPromise = new Promise((resolve) => {
        this.envReadyResolve = resolve;
      });
    }
    return this.envReadyPromise;
  }

  public markEnvReady(): void {
    if (this.envReadyResolve) {
      this.envReadyResolve();
    } else {
      this.envReadyPromise = Promise.resolve();
    }
  }

  public async writeFile(path: string, content: string): Promise<void> {
    const wc = await this.getInstance();
    await wc.fs.writeFile(path, content);
  }

  public async readFile(path: string): Promise<string> {
    const wc = await this.getInstance();
    return await wc.fs.readFile(path, 'utf8');
  }

  /**
   * Spawns a process and pipes output to the provided callback.
   * Returns a handle to the process and its exit promise.
   */
  public async spawn(
    command: string,
    args: string[],
    onOutput?: (data: string) => void
  ): Promise<{ exit: Promise<number>; process: WebContainerProcess }> {
    const wc = await this.getInstance();
    const process = await wc.spawn(command, args);

    if (onOutput) {
      process.output.pipeTo(
        new WritableStream({
          write(data) {
            onOutput(data);
          },
        })
      );
    }

    return { exit: process.exit, process };
  }

  /**
   * Recursively reads a directory. Used for type extraction and workspace analysis.
   */
  public async readDirRecursive(
    dir: string,
    filter: (path: string) => boolean = () => true,
    basePath: string = dir
  ): Promise<Record<string, string>> {
    const wc = await this.getInstance();
    let entries;
    try {
      entries = await wc.fs.readdir(dir, { withFileTypes: true });
    } catch {
      return {};
    }

    const results: Record<string, string> = {};
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      const relativePath = fullPath.replace(new RegExp(`^${basePath}/?`), '');

      if (entry.isDirectory()) {
        Object.assign(results, await this.readDirRecursive(fullPath, filter, basePath));
      } else if (filter(fullPath)) {
        try {
          results[relativePath] = await wc.fs.readFile(fullPath, 'utf8');
        } catch {}
      }
    }
    return results;
  }
}

export const webContainerService = new WebContainerService();

// Re-export old names for legacy support during transition
export const getWebContainer = () => webContainerService.getInstance();
export const runCommand = (cmd: string, args: string[], onOutput: (d: string) => void) =>
  webContainerService.spawn(cmd, args, onOutput);
export const markEnvReady = () => webContainerService.markEnvReady();
export const getEnvReady = () => webContainerService.getEnvReady();
export const readDirRecursive = (dir: string, filter?: (p: string) => boolean) =>
  webContainerService.readDirRecursive(dir, filter);
