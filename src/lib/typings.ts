import { getWebContainer } from './webcontainer'

export async function syncNodeModulesToWorker(): Promise<
  Record<string, string>
> {
  const instance = await getWebContainer()
  const libs: Record<string, string> = {}

  async function walk(dir: string) {
    try {
      const entries = await instance.fs.readdir(dir, { withFileTypes: true })
      await Promise.all(
        entries.map(async (entry) => {
          const path = `${dir}/${entry.name}`
          if (entry.name === '.bin') return // Skip binaries

          let isDir = entry.isDirectory()
          let isFile = entry.isFile()

          // WebContainers use symlinks heavily for node_modules. We MUST resolve them.
          if (entry.isSymbolicLink?.() || (!isDir && !isFile)) {
            try {
              const stat = await instance.fs.stat(path)
              isDir = stat.isDirectory()
              isFile = stat.isFile()
            } catch {
              return // Broken symlink
            }
          }

          if (isDir) {
            await walk(path)
          } else if (
            isFile && // Catch .d.ts, .ts, .mts, .cts and package.json
            (entry.name.endsWith('.ts') || entry.name === 'package.json')
          ) {
            try {
              const content = await instance.fs.readFile(path, 'utf8')
              // TS in the worker resolves from root '/', so we prefix the path
              libs[`/${path}`] = content
            } catch {
              // Ignore read errors for individual files
            }
          }
        })
      )
    } catch {
      // Ignore directory read errors
    }
  }

  await walk('node_modules')
  return libs
}
