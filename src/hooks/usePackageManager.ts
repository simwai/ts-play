import { useState, useEffect, useRef, useCallback } from 'react'
import { setupTypeAcquisition } from '@typescript/ata'
import { workerClient } from '../lib/workerClient'
import {
  runCommand,
  SYSTEM_DEPS,
  webContainerService,
} from '../lib/webcontainer'
import type { InstalledPackage } from '../components/PackageManager'
import type { ConsoleMessage } from '../components/Console'
import * as TS from 'typescript'
import type { PackageManagerStatus } from '../lib/types'
import { checkNpmPackage, getTypesPackageName } from '../lib/api'

const BUILTIN_MODULES = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
])

const PACKAGE_CHECK_CACHE = new Map<string, boolean>()

async function cachedCheckNpmPackage(pkgName: string): Promise<boolean> {
  if (PACKAGE_CHECK_CACHE.has(pkgName)) {
    return PACKAGE_CHECK_CACHE.get(pkgName)!
  }
  const exists = await checkNpmPackage(pkgName)
  PACKAGE_CHECK_CACHE.set(pkgName, exists)
  return exists
}

export function usePackageManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void,
  showNodeWarnings: boolean = true
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
  const ataRef = useRef<any>(null)

  const pendingTypings = useRef<Record<string, string>>({})
  const typingUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tsCursorPos = useRef(0)
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const syncTypingsFromContainer = useCallback(async () => {
    try {
      const types = await webContainerService.readDirRecursive(
        'node_modules',
        (path) => path.endsWith('.d.ts'),
        15
      )

      if (Object.keys(types).length > 0) {
        setPackageTypings((prev) => ({
          ...prev,
          ...types,
        }))
      }
    } catch (error) {
      console.warn('[Package Manager] Container typing sync failed:', error)
    }
  }, [])

  const checkImports = useCallback(() => {
    if (checkImportsTimeout.current) clearTimeout(checkImportsTimeout.current)
    checkImportsTimeout.current = setTimeout(async () => {
      const lines = tsCode.split('\n')
      const cursorLineIdx =
        tsCode.slice(0, tsCursorPos.current).split('\n').length - 1
      const currentLine = lines[cursorLineIdx] || ''

      if (
        /\bimport\b/.test(currentLine) &&
        !currentLine.includes('from') &&
        !currentLine.includes('import(')
      ) {
        return
      }

      try {
        const detected = await workerClient.detectImports(tsCode)
        const filtered = [...detected].filter((pkg) => {
          if (pkg.startsWith('node:')) return false
          if (BUILTIN_MODULES.has(pkg)) return false
          return true
        })
        const detectedSorted = filtered.sort()

        setInstalledPackages((previous) => {
          const previousNamesSorted = previous.map((p) => p.name).sort()

          if (
            JSON.stringify(previousNamesSorted) ===
            JSON.stringify(detectedSorted)
          ) {
            return previous
          }

          return detectedSorted.map((name) => ({ name, version: 'latest' }))
        })
      } catch (error) {
        console.error('Failed to detect imports:', error)
      }
    }, 2500) // Debounce to 2.5s
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  const flushTypings = useCallback(() => {
    if (Object.keys(pendingTypings.current).length === 0) return
    setPackageTypings((prev) => ({
      ...prev,
      ...pendingTypings.current,
    }))
    pendingTypings.current = {}
  }, [])

  useEffect(() => {
    if (!ataRef.current) {
      ataRef.current = setupTypeAcquisition({
        projectName: 'ts-play',
        typescript: TS as any,
        logger: false,
        delegate: {
          receivedFile: (code, path) => {
            pendingTypings.current[path] = code
            if (typingUpdateTimer.current)
              clearTimeout(typingUpdateTimer.current)
            typingUpdateTimer.current = setTimeout(flushTypings, 500)
          },
          errorMessage: (userFacingMessage, error) => {
            console.error('ATA Error:', userFacingMessage, error)
          },
          finished: () => {
            flushTypings()
            setStatus('idle')
          },
          started: () => {
            setStatus('syncing')
          },
        },
      })
    }
  }, [flushTypings])

  useEffect(() => {
    if (ataRef.current && tsCode) {
      ataRef.current(tsCode)
    }
  }, [tsCode])

  useEffect(() => {
    // Reconciliation logic
    const currentTargetNames = new Set(installedPackages.map((p) => p.name))
    const previouslyProcessedNames = previousPkgsRef.current

    // Don't uninstall SYSTEM_DEPS
    const systemDepsSet = new Set(SYSTEM_DEPS)

    const toAdd = [...currentTargetNames].filter(
      (x) => !previouslyProcessedNames.has(x)
    )
    const toRemove = [...previouslyProcessedNames].filter(
      (x) =>
        !currentTargetNames.has(x) &&
        !systemDepsSet.has(x) &&
        !x.startsWith('@types/')
    )

    if (toAdd.length === 0 && toRemove.length === 0) return

    previousPkgsRef.current = currentTargetNames

    const performChanges = async () => {
      try {
        // 1. Resolve @types for new packages
        const finalInstallList: string[] = []
        for (const pkg of toAdd) {
          const pkgExists = await cachedCheckNpmPackage(pkg)
          if (!pkgExists) {
            if (showNodeWarnings) {
              addMessage('warn', [
                `Package "${pkg}" not found on npm registry.`,
              ])
            }
            continue
          }
          finalInstallList.push(pkg)

          const typesPkg = getTypesPackageName(pkg)
          const typesExist = await cachedCheckNpmPackage(typesPkg)
          if (typesExist) {
            finalInstallList.push(typesPkg)
          }
        }

        // 2. Perform Uninstall
        if (toRemove.length > 0) {
          const typesToRemove = toRemove.map(getTypesPackageName)
          const allToRemove = [...toRemove, ...typesToRemove]

          setStatus('uninstalling')
          addMessage('info', ['npm uninstall ' + toRemove.join(' ') + '...'])
          await runCommand('npm', ['uninstall', ...allToRemove], (out) => {
            const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
            if (clean && !/^[/\|\-]$/.test(clean)) addMessage('info', [clean])
          })

          await syncTypingsFromContainer()
        }

        // 3. Perform Install
        if (finalInstallList.length > 0) {
          setStatus('installing')
          addMessage('info', [
            'npm install ' + finalInstallList.join(' ') + '...',
          ])

          await runCommand(
            'npm',
            ['install', '--no-progress', ...finalInstallList],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[/\|\-]$/.test(clean)) addMessage('info', [clean])
            }
          )

          await syncTypingsFromContainer()
        }
        setStatus('idle')
      } catch (error) {
        console.error('Package management failed:', error)
        setStatus('error')
        addMessage('error', [
          'Package manager error: ' + (error as Error).message,
        ])
      }
    }

    installQueue.current = installQueue.current.then(performChanges)
  }, [
    installedPackages,
    addMessage,
    showNodeWarnings,
    syncTypingsFromContainer,
  ])

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
  }
}
