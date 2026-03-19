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

      // Skip detection if user is mid-import statement
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

  useEffect(() => {
    getWebContainer().then(() => {
      checkImports()
    })
  }, [checkImports])

  // Automated Type Acquisition (ATA) and Lifecycle management
  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name))
    const previousNames = previousPkgsRef.current

    const added = [...currentNames].filter((x) => !previousNames.has(x))
    const removed = [...previousNames].filter((x) => !currentNames.has(x))

    if (added.length === 0 && removed.length === 0) return

    previousPkgsRef.current = currentNames

    const performChanges = async () => {
       try {
          // Handle Removals
          if (removed.length > 0) {
            setStatus('uninstalling')
            addMessage('info', ['npm uninstall ' + removed.join(' ') + '...'])
            await runCommand('npm', ['uninstall', ...removed], (out) => {
               const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
               if (clean && !/^[/\\|\-]$/.test(clean)) addMessage('info', [clean])
            })
          }

          // Handle Additions (ATA)
          if (added.length > 0) {
            setStatus('installing')
            const toInstall = [...added]

            // Heuristic for @types: also try to install types if they exist
            // (e.g., lodash -> @types/lodash)
            for (const pkg of added) {
               if (!pkg.startsWith('@types/')) {
                  toInstall.push(`@types/${pkg}`)
               }
            }

            // Ensure @types/node is present if not already
            if (!currentNames.has('@types/node') && !previousNames.has('@types/node')) {
               toInstall.push('@types/node')
            }

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

            if (code !== 0) {
               addMessage('warn', ['Some packages failed to install. This is normal if they lack @types counterparts.'])
            }
          }

          // Sync typings to worker host
          setStatus('syncing')
          const libs = await syncNodeModulesToWorker()
          setPackageTypings(libs)
          setStatus('idle')
       } catch (error) {
          console.error('Package management lifecycle failed:', error)
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
