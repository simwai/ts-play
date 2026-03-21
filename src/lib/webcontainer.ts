import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

let webcontainerInstance: WebContainer | undefined;
let bootPromise: Promise<WebContainer> | undefined;

// Use a promise to track if the initial environment (e.g. npm install) is ready
let envReadyPromise: Promise<void> | undefined;
let envReadyResolve: (() => void) | undefined;

/**
 * Boots the WebContainer instance if not already booted.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  bootPromise ||= WebContainer.boot().then((instance) => {
    webcontainerInstance = instance;
    return instance;
  });

  return bootPromise;
}

/**
 * Returns a promise that resolves when the initial environment is ready.
 */
export function getEnvReady(): Promise<void> {
  if (!envReadyPromise) {
    envReadyPromise = new Promise((resolve) => {
      envReadyResolve = resolve;
    });
  }
  return envReadyPromise;
}

/**
 * Marks the environment as ready.
 */
export function markEnvReady() {
  if (envReadyResolve) {
    envReadyResolve();
  } else {
    // If someone calls getEnvReady after this, it should resolve immediately
    envReadyPromise = Promise.resolve();
  }
}

/**
 * Writes multiple files to the WebContainer filesystem.
 */
export async function writeFiles(files: Record<string, string>) {
  const instance = await getWebContainer();

  for (const [path, contents] of Object.entries(files)) {
    await instance.fs.writeFile(path, contents);
  }
}

/**
 * Runs a command in the WebContainer and returns its process and an exit promise.
 */
export async function runCommand(
  cmd: string,
  args: string[],
  onOutput: (data: string) => void,
): Promise<{ exit: Promise<number>; process: WebContainerProcess }> {
  const instance = await getWebContainer();
  const process = await instance.spawn(cmd, args);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput(data);
      },
    }),
  );

  return { exit: process.exit, process };
}

/**
 * Recursively reads a directory in the WebContainer and returns a map of file paths to their contents.
 * Useful for extracting types from node_modules.
 */
export async function readDirRecursive(
  dir: string,
  filter: (path: string) => boolean = () => true,
  basePath: string = dir,
): Promise<Record<string, string>> {
  const instance = await getWebContainer();
  const entries = await instance.fs.readdir(dir, { withFileTypes: true });
  const results: Record<string, string> = {};

  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
    const relativePath = fullPath.replace(new RegExp(`^${basePath}/?`), '');

    if (entry.isDirectory()) {
      Object.assign(results, await readDirRecursive(fullPath, filter, basePath));
    } else if (filter(fullPath)) {
      try {
        const content = await instance.fs.readFile(fullPath, 'utf8');
        results[relativePath] = content;
      } catch (err) {
        console.warn(`Failed to read file: ${fullPath}`, err);
      }
    }
  }

  return results;
}
