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
import { type InstalledPackage, type PackageManagerStatus } from '../lib/types'
import type { ConsoleMessage } from '../lib/types'
import * as TS from 'typescript'
import { checkNpmPackage, getTypesPackageName } from '../lib/api'

const BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls',
  'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
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
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([])
  const [packageTypings, setPackageTypings] = useState<Record<string, string>>({})
  const [state, send] = useMachine(packageMachine)

  const status: PackageManagerStatus = state.matches('installing') ? 'installing' :
                                     state.matches('uninstalling') ? 'uninstalling' :
                                     state.matches('syncing') ? 'syncing' :
                                     state.matches('error') ? 'error' : 'idle'

  const previousPkgsRef = useRef<Set<string>>(new Set())
  const installQueue = useRef<Promise<void>>(Promise.resolve())
  const ataRef = useRef<any>(null)
  const pendingTypings = useRef<Record<string, string>>({})
  const typingUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerTypePaths = useRef<Set<string>>(new Set())

  const syncTypingsFromContainer = useCallback(async () => {
    try {
      const types = await webContainerService.readDirRecursive(
        'node_modules',
        (path) => path.endsWith('.d.ts') || path.endsWith('package.json'),
        6
      )

      if (Object.keys(types).length > 0) {
        const newPaths = new Set(Object.keys(types))
        containerTypePaths.current = newPaths

        setPackageTypings((prev) => ({ ...prev, ...types }))
      }
    } catch (error) {
      console.warn('[Package Manager] Container typing sync failed:', error)
    }
  }, [])

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
              if (typingUpdateTimer.current) clearTimeout(typingUpdateTimer.current)
              typingUpdateTimer.current = setTimeout(() => {
                 setPackageTypings(prev => ({ ...prev, ...pendingTypings.current }))
                 pendingTypings.current = {}
              }, 500)
            }
          },
          errorMessage: (userFacingMessage, error) => {
            console.warn('ATA Warning:', userFacingMessage, error)
          },
          finished: () => {
            setPackageTypings(prev => ({ ...prev, ...pendingTypings.current }))
            pendingTypings.current = {}
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

    const toAdd = [...currentTargetNames].filter(x => !previouslyProcessedNames.has(x))
    const toRemove = [...previouslyProcessedNames].filter(
      x => !currentTargetNames.has(x) && !systemDepsSet.has(x) && !x.startsWith('@types/')
    )

    if (toAdd.length === 0 && toRemove.length === 0) return
    previousPkgsRef.current = currentTargetNames

    const performChanges = async () => {
      try {
        await webContainerService.writeFile(
          'package.json',
          JSON.stringify({
            name: 'ts-play-project',
            type: 'module',
            dependencies: Object.fromEntries(
              [...currentTargetNames, ...SYSTEM_DEPS].map((p) => [p, 'latest'])
            ),
          }, null, 2)
        )

        const finalInstallList: string[] = []
        for (const pkg of toAdd) {
          if (await cachedCheckNpmPackage(pkg)) {
             finalInstallList.push(pkg)
             const typesPkg = getTypesPackageName(pkg)
             if (await cachedCheckNpmPackage(typesPkg)) finalInstallList.push(typesPkg)
          } else if (showNodeWarnings) {
             addMessage('warn', [`Package "${pkg}" not found on npm registry.`])
          }
        }

        if (toRemove.length > 0) {
          send({ type: 'UNINSTALL' })
          addMessage('info', ['npm uninstall ' + toRemove.join(' ') + '...'])
          const proc = await runCommand('npm', ['uninstall', ...toRemove.flatMap(p => [p, getTypesPackageName(p)])], (out) => {
             const clean = out.trim()
             if (clean) addMessage('info', [clean])
          })
          await proc.exit
          await syncTypingsFromContainer()
        }

        if (finalInstallList.length > 0) {
          send({ type: 'INSTALL' })
          addMessage('info', ['npm install ' + finalInstallList.join(' ') + '...'])
          const proc = await runCommand('npm', ['install', '--no-progress', ...finalInstallList], (out) => {
             const clean = out.trim()
             if (clean) addMessage('info', [clean])
          })
          await proc.exit
          await syncTypingsFromContainer()
        }
        send({ type: 'SUCCESS' })
      } catch (error) {
        send({ type: 'FAILURE', error: (error as Error).message })
        addMessage('error', ['Package manager error: ' + (error as Error).message])
      }
    }

    installQueue.current = installQueue.current.then(performChanges).catch(() => {})
  }, [installedPackages, addMessage, showNodeWarnings, syncTypingsFromContainer, send])

  return {
    installedPackages,
    packageTypings,
    installQueue,
    status,
  }
}
