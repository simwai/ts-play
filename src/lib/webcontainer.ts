import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

/**
 * WebContainerService provides a robust, singleton-based interface for interacting
 * with the browser-based Node.js runtime.
 */
class WebContainerService {
  private instance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;
  private envReadyPromise: Promise<void> | null = null;
  private envReadyResolve: (() => void) | null = null;

  /**
   * Core system dependencies that should never be uninstalled by the user.
   */
  public static readonly SYSTEM_DEPS = [
    'vite-node',
    'esbuild',
    'prettier',
    'typescript',
  ];

  /**
   * Initializes or returns the existing WebContainer instance.
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
   * Returns a promise that resolves when the environment is ready (e.g., initial install done).
   */
  public getEnvReady(): Promise<void> {
    if (!this.envReadyPromise) {
      this.envReadyPromise = new Promise((resolve) => {
        this.envReadyResolve = resolve;
      });
    }
    return this.envReadyPromise;
  }

  /**
   * Marks the environment as ready for execution.
   */
  public markEnvReady(): void {
    if (this.envReadyResolve) {
      this.envReadyResolve();
    } else {
      this.envReadyPromise = Promise.resolve();
    }
  }

  /**
   * Writes a file to the container.
   */
  public async writeFile(path: string, content: string): Promise<void> {
    const wc = await this.getInstance();
    await wc.fs.writeFile(path, content);
  }

  /**
   * Spawns a process in the container.
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
   * Recursively reads a directory and returns all files matching a filter.
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

// Re-export old names for compatibility during refactor, but they should be phased out
export const getWebContainer = () => webContainerService.getInstance();
export const runCommand = (cmd: string, args: string[], onOutput: (d: string) => void) =>
  webContainerService.spawn(cmd, args, onOutput);
export const markEnvReady = () => webContainerService.markEnvReady();
export const getEnvReady = () => webContainerService.getEnvReady();
export const readDirRecursive = (dir: string, filter?: (p: string) => boolean) =>
  webContainerService.readDirRecursive(dir, filter);
