import { WebContainer, type WebContainerProcess } from '@webcontainer/api'
import { ResultAsync, okAsync } from 'neverthrow'
import { RegexPatterns, toRegExp } from './regex'

export const SYSTEM_DEPS = [
  'typescript',
  'esbuild',
  'prettier',
  'lodash-es',
  '@types/lodash-es',
  '@types/node',
]

export class WebContainerService {
  private instance: WebContainer | null = null
  private bootPromise: Promise<WebContainer> | null = null
  private logCallbacks: Set<
    (log: { type: string; message: string; timestamp: number }) => void
  > = new Set()

  public serverUrl: string | null = null

  getInstance(): ResultAsync<WebContainer, Error> {
    if (this.instance) return okAsync(this.instance)
    if (this.bootPromise) return ResultAsync.fromPromise(this.bootPromise, (e) => e as Error)

    this.bootPromise = (async () => {
      this.emitLog('info', 'Booting WebContainer...')
      const instance = await WebContainer.boot()
      this.instance = instance
      this.emitLog('info', 'WebContainer booted.')

      instance.on('server-ready', (port, url) => {
        this.serverUrl = url
        this.emitLog('info', 'Server ready: ' + url + ' (port ' + port + ')')
      })

      await instance.fs.writeFile(
        'package.json',
        JSON.stringify(
          {
            name: 'ts-play-project',
            version: '1.0.0',
            type: 'module',
            dependencies: Object.fromEntries(SYSTEM_DEPS.map(d => [d, 'latest'])),
          },
          null,
          2
        )
      )

      this.emitLog('info', 'Installing system dependencies...')
      const installProc = await instance.spawn('npm', ['install'])
      const installExitCode = await installProc.exit
      if (installExitCode !== 0) {
          this.emitLog('error', 'Failed to install system dependencies.')
      } else {
          this.emitLog('info', 'System dependencies installed.')
      }

      return instance
    })()

    return ResultAsync.fromPromise(this.bootPromise, (e) => e as Error)
  }

  onLog(
    cb: (log: { type: string; message: string; timestamp: number }) => void
  ) {
    this.logCallbacks.add(cb)
    return () => this.logCallbacks.delete(cb)
  }

  emitLog(type: string, message: string) {
    if (!message) return
    this.logCallbacks.forEach((cb) =>
      cb({ type, message, timestamp: Date.now() })
    )
  }

  mount(files: any): ResultAsync<void, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(instance.mount(files), (e) => e as Error)
    )
  }

  mountSnapshot(url: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      (async () => {
        this.emitLog('info', 'Fetching snapshot from ' + url + '...')
        const res = await fetch(url)
        if (!res.ok) throw new Error('Snapshot fetch failed: ' + res.status)
        const buffer = await res.arrayBuffer()
        const instanceResult = await this.getInstance()
        if (instanceResult.isErr()) throw instanceResult.error
        await instanceResult.value.mount(new Uint8Array(buffer))
        this.emitLog('info', 'Snapshot mounted successfully.')
      })(),
      (e) => e as Error
    )
  }

  exportSnapshot(): ResultAsync<Uint8Array, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(
        (async () => {
          this.emitLog('info', 'Exporting environment snapshot...')
          const snapshot = (await instance.export('.', {
            format: 'binary',
          })) as Uint8Array
          this.emitLog('info', 'Snapshot exported.')
          return snapshot
        })(),
        (e) => e as Error
      )
    )
  }

  mountRawSnapshot(data: Uint8Array): ResultAsync<void, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(
        (async () => {
          await instance.mount(data)
          this.emitLog('info', 'Local snapshot mounted.')
        })(),
        (e) => e as Error
      )
    )
  }

  writeFile(path: string, content: string): ResultAsync<void, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(
        (async () => {
          const normalizedPath = path.startsWith('./') ? path.slice(2) : path
          const parts = normalizedPath.split('/')

          if (parts.length > 1) {
            let currentPath = ''
            for (let i = 0; i < parts.length - 1; i++) {
              currentPath += (currentPath ? '/' : '') + parts[i]
              try {
                await instance.fs.mkdir(currentPath, { recursive: true })
              } catch {}
            }
          }

          await instance.fs.writeFile(normalizedPath, content)
        })(),
        (e) => e as Error
      )
    )
  }

  writeFiles(files: Record<string, string>): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      (async () => {
        for (const [path, contents] of Object.entries(files)) {
          const res = await this.writeFile(path, contents)
          if (res.isErr()) throw res.error
        }
      })(),
      (e) => e as Error
    )
  }

  readFile(path: string): ResultAsync<string, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(instance.fs.readFile(path, 'utf8'), (e) => e as Error)
    )
  }

  spawnManaged(
    cmd: string,
    args: string[],
    options: { silent?: boolean; onLog?: (line: string) => void } = {}
  ): ResultAsync<WebContainerProcess, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(
        (async () => {
          const proc = await instance.spawn(cmd, args)

          const reader = proc.output.getReader()
          const decoder = new TextDecoder()
          let currentLineBuffer = ''

          ;(async () => {
            try {
              let linesProcessedSinceYield = 0
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                let chunk = value as any
                if (value instanceof Uint8Array) {
                  chunk = decoder.decode(value, { stream: true })
                }

                currentLineBuffer += chunk
                const lines = currentLineBuffer.split(toRegExp(RegexPatterns.NEWLINE))

                const last = lines[lines.length - 1]
                const hasIncompleteAnsi = toRegExp(
                  RegexPatterns.INCOMPLETE_ANSI
                ).test(last)

                const processLines = async (linesToProc: string[]) => {
                  if (!linesToProc) return;
                  for (const line of linesToProc) {
                    const simplified = line.replace(
                      toRegExp(RegexPatterns.EXCESSIVE_WHITESPACE),
                      '    '
                    )
                    if (!options.silent) this.emitLog('info', simplified)
                    options.onLog?.(simplified)

                    linesProcessedSinceYield++
                    if (linesProcessedSinceYield > 50) {
                      await new Promise((resolve) => setTimeout(resolve, 0))
                      linesProcessedSinceYield = 0
                    }
                  }
                }

                if (!hasIncompleteAnsi) {
                  currentLineBuffer = lines.pop() || ''
                  await processLines(lines)
                } else {
                  const completeLines = lines.slice(0, -1)
                  currentLineBuffer = lines[lines.length - 1]
                  await processLines(completeLines)
                }
              }
              if (currentLineBuffer) {
                if (!options.silent) this.emitLog('info', currentLineBuffer)
                options.onLog?.(currentLineBuffer)
              }
            } catch (err: any) {
              console.warn('[WC Service] Stream read error:', err.message)
            } finally {
              reader.releaseLock()
            }
          })()

          return proc
        })(),
        (e) => e as Error
      )
    )
  }

  readDirRecursive(
    dir: string,
    filter?: (path: string) => boolean,
    maxDepth = 6,
    maxFiles = 2000
  ): ResultAsync<Record<string, string>, Error> {
    return this.getInstance().andThen((instance) =>
      ResultAsync.fromPromise(
        (async () => {
          const results: Record<string, string> = {}
          let fileCount = 0

          const read = async (currentPath: string, depth: number) => {
            if (depth > maxDepth) return

            try {
              const entries = await instance.fs.readdir(currentPath, {
                withFileTypes: true,
              })
              for (const entry of entries) {
                const fullPath = currentPath + '/' + entry.name

                if (
                  entry.name === '.git' ||
                  entry.name === '.husky' ||
                  entry.name === '.bin'
                )
                  continue

                if (entry.isDirectory()) {
                  if (++fileCount > maxFiles) return
                  await read(fullPath, depth + 1)
                } else if (!filter || filter(fullPath)) {
                  const content = await instance.fs.readFile(fullPath, 'utf8')
                  const absolutePath = fullPath.startsWith('/')
                    ? fullPath
                    : '/' + fullPath
                  results[absolutePath] = content
                }
              }
            } catch {}
          }

          await read(dir, 0)
          return results
        })(),
        (e) => e as Error
      )
    )
  }
}

export const webContainerService = new WebContainerService()

export const getWebContainer = () => webContainerService.getInstance()
export const writeFiles = (files: Record<string, string>) =>
  webContainerService.writeFiles(files)
export const readFile = (path: string) => webContainerService.readFile(path)
export const runCommand = (
  cmd: string,
  args: string[],
  onOutput: (d: string) => void
): ResultAsync<WebContainerProcess, Error> => {
  return webContainerService.spawnManaged(cmd, args, {
    onLog: onOutput,
  })
}
