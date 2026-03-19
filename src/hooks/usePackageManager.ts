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
        // Filter out built-ins from "detected" list
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

       // Ensure @types/node is present if built-ins are used
       // This is safe to install even if not explicitly detected by worker,
       // because we want node typings in the LS host anyway.
       if (!currentNames.has('@types/node')) {
         toInstall.push('@types/node')
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
