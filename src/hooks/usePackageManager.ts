import { useState, useEffect, useRef, useCallback } from 'react'
import { workerClient } from '../lib/workerClient'
import { runCommand, getWebContainer } from '../lib/webcontainer'
import { syncNodeModulesToWorker } from '../lib/typings'
import type { InstalledPackage } from '../components/PackageManager'
import type { ConsoleMessage } from '../components/Console'

export function usePackageManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [installedPackages, setInstalledPackages] = useState<
    InstalledPackage[]
  >([])
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>(
    {}
  )

  const previousPkgsRef = useRef<Set<string>>(new Set())
  const installQueue = useRef<Promise<void>>(Promise.resolve())

  const tsCursorPos = useRef(0)
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current)
    checkImportsTimeout.current = setTimeout(async () => {
      const lines = tsCode.split('\n')
      const cursorLineIdx =
        tsCode.slice(0, tsCursorPos.current).split('\n').length - 1
      const currentLine = lines[cursorLineIdx] || ''

      if (/\bimport\b/.test(currentLine) && !currentLine.includes('from') && !currentLine.includes('import(')) {
        return
      }

      try {
        const detected = await workerClient.detectImports(tsCode)
        const detectedSorted = [...detected].sort()

        setInstalledPackages((previous) => {
          const previousNamesSorted = previous
            .map((p) => p.name)
            .sort()

          if (JSON.stringify(previousNamesSorted) === JSON.stringify(detectedSorted)) {
            return previous
          }

          return detectedSorted.map((name) => ({ name, version: 'latest' }))
        })
      } catch (error) {
        console.error('Failed to detect imports:', error)
      }
    }, 1000)
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  useEffect(() => {
    getWebContainer().then(() => {
      checkImports()
    })
  }, [checkImports])

  // Automated Type Acquisition (ATA) and Install Queue
  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name))
    const previousNames = previousPkgsRef.current

    const added = [...currentNames].filter((x) => !previousNames.has(x))
    const removed = [...previousNames].filter((x) => !currentNames.has(x))

    if (added.length === 0 && removed.length === 0) return

    previousPkgsRef.current = currentNames

    const performInstalls = async () => {
       const toInstall = [...added]

       // Smart Type Acquisition: Automatically add @types/ packages if they look missing
       // This is a heuristic - we'll refine it by checking package.json after the first pass if needed,
       // but for commonly used libraries that don't ship types, this is a huge UX win.
       for (const pkg of added) {
          // Skip if it's already a @types/ package
          if (pkg.startsWith('@types/')) continue

          // Heuristic: Many common libraries need separate types
          // We can also check if we're using node built-ins to auto-install @types/node
          const typesPkg = pkg.startsWith('@')
            ? `@types/${pkg.slice(1).replace('/', '__')}`
            : `@types/${pkg}`

          // We don't want to spam, so we'll only try installing @types/ for popular ones
          // OR better: we can just try to install it and ignore failures.
          // For now, let's always include @types/node if any builtin was detected or if no imports detected but code exists
          if (!currentNames.has('@types/node')) {
             toInstall.push('@types/node')
          }

          if (!currentNames.has(typesPkg)) {
             // toInstall.push(typesPkg) // We'll do this more selectively or just let npm handle it
          }
       }

       if (toInstall.length > 0) {
          addMessage('info', ['npm install ' + toInstall.join(' ') + '...'])
          const code = await runCommand(
            'npm',
            ['install', '--no-progress', ...toInstall],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean])
            }
          )
          if (code === 0) {
            const libs = await syncNodeModulesToWorker()
            setPackageTypings(libs)
          }
       }

       if (removed.length > 0) {
          // Cleanup logic...
       }
    }

    installQueue.current = installQueue.current.then(performInstalls)
  }, [installedPackages, addMessage])

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
  }
}
