import { getWebContainer } from './webcontainer'

export async function syncNodeModulesToWorker(): Promise<
  Record<string, string>
> {
  const containerInstance = await getWebContainer()
  const libraryFiles: Record<string, string> = {}

  async function recursivelyCollectTypeDefinitions(directoryPath: string) {
    try {
      const directoryEntries = await containerInstance.fs.readdir(
        directoryPath,
        { withFileTypes: true }
      )

      await Promise.all(
        directoryEntries.map(async (entry) => {
          const entryPath = `${directoryPath}/${entry.name}`

          if (entry.name === '.bin') {
            return
          }

          let isDirectoryEntry = entry.isDirectory()
          let isFileEntry = entry.isFile()

          // WebContainer sometimes returns directory/file as false for symlinks
          // We use type assertion because some properties might not be in the public API types yet
          const entryAny = entry as any
          const isPotentiallySymlink =
            entryAny.isSymbolicLink?.() ||
            (!isDirectoryEntry && !isFileEntry)

          if (isPotentiallySymlink) {
            try {
              // use any for stat as it might be internal or not exposed in current @webcontainer/api version
              const entryStats = await (containerInstance.fs as any).stat(
                entryPath
              )
              isDirectoryEntry = entryStats.isDirectory()
              isFileEntry = entryStats.isFile()
            } catch {
              return
            }
          }

          if (isDirectoryEntry) {
            await recursivelyCollectTypeDefinitions(entryPath)
          } else if (isFileEntry) {
            const name = entry.name
            const isDts =
              name.endsWith('.d.ts') ||
              name.endsWith('.d.mts') ||
              name.endsWith('.d.cts')
            const isPackageJson = name === 'package.json'

            if (isDts || isPackageJson) {
              try {
                const fileContent = await containerInstance.fs.readFile(
                  entryPath,
                  'utf8'
                )
                libraryFiles[`/${entryPath}`] = fileContent
              } catch {
                // Silently skip
              }
            }
          }
        })
      )
    } catch {
      // Silently skip
    }
  }

  await recursivelyCollectTypeDefinitions('node_modules')
  return libraryFiles
}
