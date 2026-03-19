import { useState, useEffect, useRef, useCallback } from 'react'
import { workerClient } from '../lib/workerClient'
import { runCommand, getWebContainer } from '../lib/webcontainer'
import { syncNodeModulesToWorker } from '../lib/typings'
import type { InstalledPackage } from '../components/PackageManager'
import type { ConsoleMessage } from '../components/Console'

const BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
  'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib'
])

export type PackageManagerStatus = 'idle' | 'installing' | 'uninstalling' | 'syncing' | 'error'

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
  const [status, setStatus] = useState<PackageManagerStatus>('idle')

  const previousPkgsRef = useRef<Set<string>>(new Set())
  const installQueue = useRef<Promise<void>>(Promise.resolve())
  const initialSetupDone = useRef(false)

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
        const filtered = [...detected].filter(pkg => {
          if (pkg.startsWith('node:')) return false
          if (BUILTIN_MODULES.has(pkg)) return false
          return true
        })
        const detectedSorted = filtered.sort()

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

  // Initial silent install of foundational types
  useEffect(() => {
    const init = async () => {
      if (initialSetupDone.current) return
      initialSetupDone.current = true

      const container = await getWebContainer()
      installQueue.current = installQueue.current.then(async () => {
         try {
           setStatus('installing')
           // Silently install @types/node and other basics if missing
           await runCommand('npm', ['install', '--no-progress', '@types/node'], () => {})
           const libs = await syncNodeModulesToWorker()
           setPackageTypings(libs)
           setStatus('idle')
         } catch (e) {
           console.error('Initial ATA failed:', e)
           setStatus('idle')
         }
      })
      checkImports()
    }
    init()
  }, [checkImports])

  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name))
    const previousNames = previousPkgsRef.current

    const added = [...currentNames].filter((x) => !previousNames.has(x))
    const removed = [...previousNames].filter((x) => !currentNames.has(x))

    if (added.length === 0 && removed.length === 0) return

    previousPkgsRef.current = currentNames

    const performChanges = async () => {
       const container = await getWebContainer()
       try {
          if (removed.length > 0) {
            setStatus('uninstalling')
            addMessage('info', ['npm uninstall ' + removed.join(' ') + '...'])
            await runCommand('npm', ['uninstall', ...removed], (out) => {
               const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
               if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean])
            })
          }

          if (added.length > 0) {
            setStatus('installing')
            addMessage('info', ['npm install ' + added.join(' ') + '...'])

            const exitCode = await runCommand(
              'npm',
              ['install', '--no-progress', ...added],
              (out) => {
                const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
                if (clean && !/^[/\\|\-]$/.test(clean))
                  addMessage('info', [clean])
              }
            )

            if (exitCode === 0) {
               // ATA Check: for each added package, check if it has types
               const typesToInstall: string[] = []
               for (const pkg of added) {
                  try {
                    const pkgJsonPath = `node_modules/${pkg}/package.json`
                    const content = await container.fs.readFile(pkgJsonPath, 'utf8')
                    const pkgJson = JSON.parse(content)

                    const hasBuiltInTypes = pkgJson.types || pkgJson.typings ||
                                           (pkgJson.exports && JSON.stringify(pkgJson.exports).includes('.d.ts'))

                    if (!hasBuiltInTypes) {
                       // Double check if index.d.ts exists
                       try {
                          await container.fs.readFile(`node_modules/${pkg}/index.d.ts`)
                       } catch {
                          typesToInstall.push(`@types/${pkg}`)
                       }
                    }
                  } catch {
                    // If we can't find/read package.json, try installing types anyway
                    typesToInstall.push(`@types/${pkg}`)
                  }
               }

               if (typesToInstall.length > 0) {
                  addMessage('info', ['Silently acquiring type definitions...'])
                  await runCommand('npm', ['install', '--no-progress', ...typesToInstall], () => {})
               }
            }
          }

          setStatus('syncing')
          const libs = await syncNodeModulesToWorker()
          setPackageTypings(libs)
          setStatus('idle')
       } catch (error) {
          console.error('Package management failed:', error)
          setStatus('error')
          addMessage('error', ['Package manager error: ' + (error as Error).message])
       }
    }

    installQueue.current = installQueue.current.then(performChanges)
  }, [installedPackages, addMessage])

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status
  }
}
