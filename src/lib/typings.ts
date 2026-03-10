import { getWebContainer } from './webcontainer';

export async function syncNodeModulesToWorker(): Promise<Record<string, string>> {
  const instance = await getWebContainer();
  const libs: Record<string, string> = {};

  async function walk(dir: string) {
    try {
      const entries = await instance.fs.readdir(dir, { withFileTypes: true });
      await Promise.all(entries.map(async (entry) => {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === '.bin') return; // Skip binaries
          await walk(path);
        } else if (entry.isFile()) {
          // We only need type declarations and package.json for module resolution
          if (entry.name.endsWith('.d.ts') || entry.name === 'package.json') {
            try {
              const content = await instance.fs.readFile(path, 'utf-8');
              // TS in the worker resolves from root '/', so we prefix the path
              libs[`/${path}`] = content;
            } catch {
              // Ignore read errors for individual files
            }
          }
        }
      }));
    } catch {
      // Ignore directory read errors
    }
  }

  await walk('node_modules');
  return libs;
}
