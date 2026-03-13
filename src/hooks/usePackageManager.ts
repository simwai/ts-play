import { useState, useEffect, useRef, useCallback } from 'react'
import { workerClient } from '../lib/workerClient'
import { runCommand } from '../lib/webcontainer'
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

      // Delay detection if the user is actively editing an import line
      if (/\bimport\b/.test(currentLine)) {
        return
      }

      try {
        const detected = await workerClient.detectImports(tsCode)
        setInstalledPackages((previous) => {
          const previousNames = previous
            .map((p) => p.name)
            .sort()
            .join(',')
          const newNames = [...detected].sort().join(',')
          if (previousNames === newNames) return previous
          return detected.map((name) => ({ name, version: 'latest' }))
        })
      } catch (error) {
        console.error('Failed to detect imports:', error)
      }
    }, 500)
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  // Background NPM Install/Uninstall Queue
  useEffect(() => {
    const currentNames = new Set(installedPackages.map((p) => p.name))
    const previousNames = previousPkgsRef.current

    const added = [...currentNames].filter((x) => !previousNames.has(x))
    const removed = [...previousNames].filter((x) => !currentNames.has(x))

    if (added.length === 0 && removed.length === 0) return

    previousPkgsRef.current = currentNames

    if (added.length > 0) {
      installQueue.current = installQueue.current
        .then(async () => {
          addMessage('info', [`npm install ${added.join(' ')}...`])
          const code = await runCommand(
            'npm',
            ['install', '--no-progress', ...added],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean])
            }
          )
          if (code === 0) {
            const libs = await syncNodeModulesToWorker()
            setPackageTypings(libs)
          } else {
            addMessage('error', [`npm install failed with code ${code}`])
          }
        })
        .catch((error) => {
          addMessage('error', [`npm install error: ${error.message}`])
        })
    }

    if (removed.length > 0) {
      installQueue.current = installQueue.current
        .then(async () => {
          addMessage('info', [`npm uninstall ${removed.join(' ')}...`])
          const code = await runCommand(
            'npm',
            ['uninstall', '--no-progress', ...removed],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\\|\-]$/.test(clean))
                addMessage('info', [clean])
            }
          )
          if (code === 0) {
            const libs = await syncNodeModulesToWorker()
            setPackageTypings(libs)
          } else {
            addMessage('error', [`npm uninstall failed with code ${code}`])
          }
        })
        .catch((error) => {
          addMessage('error', [`npm uninstall error: ${error.message}`])
        })
    }
  }, [installedPackages, addMessage])

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
  }
}
