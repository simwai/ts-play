import {
  WebContainer,
  type FileSystemTree,
  type WebContainerProcess,
} from '@webcontainer/api'
import { playgroundStore } from './state-manager'
import { RegexPatterns, toRegExp } from './regex'

export const SYSTEM_DEPS = [
  'typescript',
  'esbuild',
  'prettier',
  'lodash-es',
  '@types/lodash-es',
  '@types/node',
]

// Exported only through the webContainerService singleton below.
class WebContainerService {
  private instance: WebContainer | null = null
  private bootPromise: Promise<WebContainer> | null = null
  private logCallbacks: Set<
    (log: { type: string; message: string; timestamp: number }) => void
  > = new Set()

  public serverUrl: string | null = null

  async getInstance(): Promise<WebContainer> {
    if (this.instance) return this.instance
    if (this.bootPromise) return this.bootPromise

    this.bootPromise = (async () => {
      playgroundStore.setState({ compilerStatus: 'loading' })
      this.emitLog('info', 'Booting WebContainer...')
      try {
        const instance = await WebContainer.boot()
        this.instance = instance
        this.emitLog('info', 'WebContainer booted.')

        instance.on('server-ready', (port, url) => {
          this.serverUrl = url
          this.emitLog('info', 'Server ready: ' + url + ' (port ' + port + ')')
        })

        return instance
      } catch (error) {
        // A cancelled boot (e.g. StrictMode double-mount or HMR teardown)
        // must not poison the singleton: reset so the next call can retry.
        this.bootPromise = null
        throw error
      }
    })()

    return this.bootPromise
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

  async enqueue<T>(
    actionName: string,
    task: (instance: WebContainer) => Promise<T>
  ): Promise<T> {
    return playgroundStore.enqueue(actionName, async () => {
      const instance = await this.getInstance()
      return task(instance)
    })
  }

  async mount(files: FileSystemTree) {
    const instance = await this.getInstance()
    await instance.mount(files)
  }

  async writeFile(path: string, content: string) {
    const instance = await this.getInstance()
    const normalizedPath = path.startsWith('./') ? path.slice(2) : path
    const parts = normalizedPath.split('/')

    if (parts.length > 1) {
      let currentPath = ''
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? '/' : '') + parts[i]
        try {
          await instance.fs.mkdir(currentPath, { recursive: true })
        } catch (err: unknown) {
          this.emitLog(
            'warn',
            `mkdir ${currentPath} failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        }
      }
    }

    await instance.fs.writeFile(normalizedPath, content)
  }

  async writeFiles(files: Record<string, string>) {
    for (const [path, contents] of Object.entries(files)) {
      await this.writeFile(path, contents)
    }
  }

  async readFile(path: string) {
    const instance = await this.getInstance()
    return instance.fs.readFile(path, 'utf8')
  }

  async spawnManaged(
    cmd: string,
    args: string[],
    options: { silent?: boolean; onLog?: (line: string) => void } = {}
  ): Promise<WebContainerProcess> {
    const instance = await this.getInstance()
    const proc = await instance.spawn(cmd, args)

    const reader = proc.output.getReader()
    let currentLineBuffer = ''

    const processLines = (lines: string[]) => {
      for (const line of lines) {
        const simplified = line.replace(
          toRegExp(RegexPatterns.EXCESSIVE_WHITESPACE),
          '    '
        )
        if (!options.silent) this.emitLog('info', simplified)
        options.onLog?.(simplified)
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = value as string
        currentLineBuffer += chunk
        const lines = currentLineBuffer.split(toRegExp(RegexPatterns.NEWLINE))

        const last = lines[lines.length - 1]
        if (last === undefined) continue

        const hasIncompleteAnsi = toRegExp(RegexPatterns.INCOMPLETE_ANSI).test(
          last
        )

        if (hasIncompleteAnsi) {
          const completeLines = lines.slice(0, -1)
          currentLineBuffer = lines[lines.length - 1] || ''
          processLines(completeLines)
        } else {
          currentLineBuffer = lines.pop() || ''
          processLines(lines)
        }
      }

      if (currentLineBuffer) {
        if (!options.silent) this.emitLog('info', currentLineBuffer)
        options.onLog?.(currentLineBuffer)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[WC Service] Stream read error:', message)
    } finally {
      reader.releaseLock()
    }

    return proc
  }
}

export const webContainerService = new WebContainerService()

export const getWebContainer = () => webContainerService.getInstance()
export const writeFiles = (files: Record<string, string>) =>
  webContainerService.writeFiles(files)
export const runCommand = (
  cmd: string,
  args: string[],
  onOutput: (d: string) => void
) =>
  webContainerService
    .spawnManaged(cmd, args, { onLog: onOutput })
    .then((p) => ({ exit: p.exit, process: p }))
