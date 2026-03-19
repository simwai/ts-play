import { getWebContainer } from './webcontainer'

export async function syncNodeModulesToWorker(): Promise<Record<string, string>> {
  const containerInstance = await getWebContainer()
  const libraryFiles: Record<string, string> = {}

  async function recursivelyCollectTypeDefinitions(directoryPath: string) {
    try {
      const directoryEntries = await containerInstance.fs.readdir(directoryPath, { withFileTypes: true })

      await Promise.all(
        directoryEntries.map(async (entry) => {
          const entryPath = `${directoryPath}/${entry.name}`

          if (entry.name === '.bin') {
            return
          }

          let isDirectoryEntry = entry.isDirectory()
          let isFileEntry = entry.isFile()

          const isPotentiallySymlink = (entry as any).isSymbolicLink?.() || (!isDirectoryEntry && !isFileEntry)
          if (isPotentiallySymlink) {
            try {
              const entryStats = await (containerInstance.fs as any).stat(entryPath)
              isDirectoryEntry = entryStats.isDirectory()
              isFileEntry = entryStats.isFile()
            } catch {
              return
            }
          }

          if (isDirectoryEntry) {
            await recursivelyCollectTypeDefinitions(entryPath)
          } else if (isFileEntry) {
            const hasTypeScriptExtension = entry.name.endsWith('.d.ts') ||
                                          entry.name.endsWith('.d.mts') ||
                                          entry.name.endsWith('.d.cts')
            const isPackageManifest = entry.name === 'package.json'

            if (hasTypeScriptExtension || isPackageManifest) {
              try {
                const fileContent = await containerInstance.fs.readFile(entryPath, 'utf8')
                libraryFiles[`/${entryPath}`] = fileContent
              } catch {
                // Silently skip files that cannot be read
              }
            }
          }
        })
      )
    } catch {
      // Silently skip directories that cannot be accessed
    }
  }

  await recursivelyCollectTypeDefinitions('node_modules')
  return libraryFiles
}
