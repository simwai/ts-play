import { useState, useEffect, useRef, useCallback } from 'react'
import { setupTypeAcquisition } from '@typescript/ata'
import { useMachine } from '@xstate/react'
import { packageMachine } from '../lib/machines/packageMachine'
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
  try {
    const exists = await checkNpmPackage(pkgName)
    PACKAGE_CHECK_CACHE.set(pkgName, exists)
    return exists
  } catch {
    PACKAGE_CHECK_CACHE.set(pkgName, false)
    return false
  }
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
  const [state, send] = useMachine(packageMachine)

  const previousPkgsRef = useRef<Set<string>>(new Set())
  const installQueue = useRef<Promise<void>>(Promise.resolve())
  const ataRef = useRef<any>(null)

  const pendingTypings = useRef<Record<string, string>>({})
  const typingUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerTypePaths = useRef<Set<string>>(new Set())

  const tsCursorPos = useRef(0)
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const syncTypingsFromContainer = useCallback(async () => {
    const result = await webContainerService.readDirRecursive(
      'node_modules',
      (path) => path.endsWith('.d.ts') || path.endsWith('package.json'),
      6
    )

    result.match(
      (types) => {
        if (Object.keys(types).length > 0) {
          const newPaths = new Set(Object.keys(types))
          containerTypePaths.current = newPaths

          setPackageTypings((prev) => {
            const next = { ...prev }
            for (const [path, content] of Object.entries(types)) {
              next[path] = content
            }
            return next
          })
        }
      },
      (error) => {
        console.warn('[Package Manager] Container typing sync failed:', error)
      }
    )
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
        const detectedResult = await workerClient.detectImports(tsCode)
        if (detectedResult.isErr()) {
           console.error('Failed to detect imports:', detectedResult.error)
           return
        }
        const detected = detectedResult.value
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
    }, 2500)
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  const flushTypings = useCallback(() => {
    if (Object.keys(pendingTypings.current).length === 0) return
    setPackageTypings((prev) => {
      const next = { ...prev, ...pendingTypings.current }
      pendingTypings.current = {}
      return next
    })
  }, [])

  const flushTypingsRef = useRef(flushTypings)
  useEffect(() => {
    flushTypingsRef.current = flushTypings
  }, [flushTypings])

  useEffect(() => {
    if (!ataRef.current) {
      ataRef.current = setupTypeAcquisition({
        projectName: 'ts-play',
        typescript: TS as any,
        logger: false,
        delegate: {
          receivedFile: (code, path) => {
            if (containerTypePaths.current.has(path)) return

            if (!path.startsWith('/node_modules/')) {
              pendingTypings.current[path] = code
              if (typingUpdateTimer.current)
                clearTimeout(typingUpdateTimer.current)
              typingUpdateTimer.current = setTimeout(() => flushTypingsRef.current(), 500)
            }
          },
          errorMessage: (userFacingMessage, error) => {
            console.warn('ATA Warning:', userFacingMessage, error)
          },
          finished: () => {
            flushTypingsRef.current()
            send({ type: 'SUCCESS' })
          },
          started: () => {
            send({ type: 'SYNC' })
          },
        },
      })
    }
  }, [send])

  useEffect(() => {
    if (ataRef.current && tsCode) {
      ataRef.current(tsCode)
    }
  }, [tsCode])

  useEffect(() => {
    const currentTargetNames = new Set(installedPackages.map((p) => p.name))
    const previouslyProcessedNames = previousPkgsRef.current
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
        const writeRes = await webContainerService.writeFile(
          'package.json',
          JSON.stringify(
            {
              name: 'ts-play-project',
              type: 'module',
              dependencies: Object.fromEntries(
                [...currentTargetNames, ...SYSTEM_DEPS].map((p) => [p, 'latest'])
              ),
            },
            null,
            2
          )
        )
        if (writeRes.isErr()) throw writeRes.error

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

        if (toRemove.length > 0) {
          send({ type: 'UNINSTALL' })
          addMessage('info', ['npm uninstall ' + toRemove.join(' ') + '...'])
          const procRes = await runCommand('npm', ['uninstall', ...toRemove.map(p => [p, getTypesPackageName(p)]).flat()], (out) => {
            const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
            if (clean && !/^[\/|\-]$/.test(clean)) addMessage('info', [clean])
          })
          if (procRes.isErr()) throw procRes.error
          await procRes.value.exit

          await syncTypingsFromContainer()
          send({ type: 'SUCCESS' })
        }

        if (finalInstallList.length > 0) {
          send({ type: 'INSTALL' })
          addMessage('info', [
            'npm install ' + finalInstallList.join(' ') + '...',
          ])

          const procRes = await runCommand(
            'npm',
            ['install', '--no-progress', ...finalInstallList],
            (out) => {
              const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
              if (clean && !/^[\/|\-]$/.test(clean)) addMessage('info', [clean])
            }
          )
          if (procRes.isErr()) throw procRes.error
          await procRes.value.exit

          await syncTypingsFromContainer()
          send({ type: 'SUCCESS' })
        }
      } catch (error) {
        console.error('Package management failed:', error)
        const message = (error as Error).message
        send({ type: 'FAILURE', error: message })
        addMessage('error', [
          'Package manager error: ' + message,
        ])
      }
    }

    installQueue.current = installQueue.current.then(performChanges).catch((error) => {
        console.error("Package queue failure:", error);
        send({ type: 'FAILURE', error: (error as Error).message });
        addMessage('error', ['Package manager error: ' + (error as Error).message]);
    })
  }, [
    installedPackages,
    addMessage,
    showNodeWarnings,
    syncTypingsFromContainer,
    send
  ])

  const status: PackageManagerStatus = state.matches('installing')
    ? 'installing'
    : state.matches('uninstalling')
    ? 'uninstalling'
    : state.matches('syncing')
    ? 'syncing'
    : state.matches('error')
    ? 'error'
    : 'idle'

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
  }
}
