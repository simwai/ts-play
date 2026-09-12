import { useState, useEffect, useRef, useCallback } from 'react'
import { setupTypeAcquisition } from '@typescript/ata'
import { workerClient } from '../lib/workerClient'
import { runCommand, SYSTEM_DEPS } from '../lib/webcontainer'
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
  if (PACKAGE_CHECK_CACHE.has(pkgName)) return PACKAGE_CHECK_CACHE.get(pkgName)!
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
  const generationRef = useRef(0)
  const ataRef = useRef<ReturnType<typeof setupTypeAcquisition> | null>(null)
  const pendingTypings = useRef<Record<string, string>>({})
  const typingUpdateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const tsCursorPos = useRef(0)
  const checkImportsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const checkImports = useCallback(() => {
    clearTimeout(checkImportsTimeout.current)
    checkImportsTimeout.current = setTimeout(async () => {
      try {
        const detected = await workerClient.detectImports(tsCode)
        const filtered = [...detected].filter(
          (pkg) => !pkg.startsWith('node:') && !BUILTIN_MODULES.has(pkg)
        )
        const sorted = filtered.sort()
        setInstalledPackages((prev) => {
          const prevNames = prev.map((p) => p.name).sort()
          return JSON.stringify(prevNames) === JSON.stringify(sorted)
            ? prev
            : sorted.map((name) => ({ name, version: 'latest' }))
        })
      } catch (error) {
        console.error('Import detection failed:', error)
      }
    }, 2500)
  }, [tsCode])

  useEffect(() => {
    checkImports()
  }, [tsCode, checkImports])

  const flushTypings = useCallback(() => {
    if (Object.keys(pendingTypings.current).length === 0) return
    const synthetic: Record<string, string> = {}
    const paths = Object.keys(pendingTypings.current)
    const pkgRoots = new Set<string>()
    for (const p of paths) {
      const m = p.match(/^\/node_modules\/([^/@][^/]*)\//)
      if (m) pkgRoots.add(m[1])
    }
    for (const pkg of pkgRoots) {
      const rootIndex = `/node_modules/${pkg}/index.d.ts`
      if (pendingTypings.current[rootIndex]) continue
      const pkgFiles = paths.filter((p) =>
        p.startsWith(`/node_modules/${pkg}/`)
      )
      const mainDts =
        pkgFiles.find((p) => p.endsWith('index.d.ts')) ?? pkgFiles[0]
      if (mainDts) {
        const relativePath = mainDts.replace(`/node_modules/${pkg}/`, './')
        synthetic[rootIndex] =
          `export * from '${relativePath}';\nexport { default } from '${relativePath}';`
      }
    }
    setPackageTypings((prev) => ({
      ...prev,
      ...pendingTypings.current,
      ...synthetic,
    }))
    pendingTypings.current = {}
  }, [])

  useEffect(() => {
    if (!ataRef.current) {
      ataRef.current = setupTypeAcquisition({
        projectName: 'ts-play',
        typescript: TS,
        logger: {
          log: () => {},
          error: () => {},
          groupCollapsed: () => {}, // no-op
          groupEnd: () => {}, // no-op
        },
        delegate: {
          receivedFile: (code, path) => {
            pendingTypings.current[path] = code
            clearTimeout(typingUpdateTimer.current)
            typingUpdateTimer.current = setTimeout(flushTypings, 500)
          },
          errorMessage: (msg, error) => console.error('ATA Error:', msg, error),
          finished: () => {
            flushTypings()
            setStatus('idle')
          },
          started: () => setStatus('syncing'),
        },
      })
    }
  }, [flushTypings])

  useEffect(() => {
    if (!ataRef.current || !tsCode) return
    const t = setTimeout(() => ataRef.current!(tsCode), 1500)
    return () => clearTimeout(t)
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
    const currentGeneration = ++generationRef.current

    const performChanges = async () => {
      if (currentGeneration !== generationRef.current) return
      try {
        const finalInstallList: string[] = []
        for (const pkg of toAdd) {
          const exists = await cachedCheckNpmPackage(pkg)
          if (!exists) {
            if (showNodeWarnings)
              addMessage('warn', [
                `Package "${pkg}" not found on npm registry.`,
              ])
            continue
          }
          finalInstallList.push(pkg)
          const typesPkg = getTypesPackageName(pkg)
          const typesExist = await cachedCheckNpmPackage(typesPkg)
          if (typesExist) finalInstallList.push(typesPkg)
        }
        if (currentGeneration !== generationRef.current) return

        if (toRemove.length > 0) {
          setStatus('uninstalling')
          addMessage('info', ['npm uninstall ' + toRemove.join(' ') + '...'])
          const allToRemove = [
            ...toRemove,
            ...toRemove.map(getTypesPackageName),
          ]
          await runCommand('npm', ['uninstall', ...allToRemove], (out) => {
            const clean = out.replaceAll(/\u001B\[[\d;]*[a-zA-Z]/g, '').trim()
            if (clean && !/^[/\|\-]$/.test(clean)) addMessage('info', [clean])
          })
        }
        if (currentGeneration !== generationRef.current) return

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
          if (ataRef.current && tsCode) ataRef.current(tsCode)
        }
        setStatus('idle')
      } catch (error) {
        if (currentGeneration === generationRef.current) {
          console.error('Package management failed:', error)
          setStatus('error')
          const err = error instanceof Error ? error : new Error(String(error))
          addMessage('error', ['Package manager error: ' + err.message])
        }
      }
    }

    installQueue.current = installQueue.current.then(performChanges)
  }, [installedPackages, addMessage, showNodeWarnings])

  return {
    installedPackages,
    packageTypings,
    tsCursorPos,
    checkImports,
    installQueue,
    status,
  }
}
