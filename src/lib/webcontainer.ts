import { WebContainer, type WebContainerProcess } from '@webcontainer/api'
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

export class WebContainerService {
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
      const instance = await WebContainer.boot()
      this.instance = instance
      this.emitLog('info', 'WebContainer booted.')

      instance.on('server-ready', (port, url) => {
        this.serverUrl = url
        this.emitLog('info', 'Server ready: ' + url + ' (port ' + port + ')')
      })

      return instance
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

  async mount(files: any) {
    const instance = await this.getInstance()
    await instance.mount(files)
  }

  async mountSnapshot(url: string) {
    this.emitLog('info', 'Fetching snapshot from ' + url + '...')
    const res = await fetch(url)
    if (!res.ok) throw new Error('Snapshot fetch failed: ' + res.status)
    const buffer = await res.arrayBuffer()
    const instance = await this.getInstance()
    await instance.mount(new Uint8Array(buffer))
    this.emitLog('info', 'Snapshot mounted successfully.')
  }

  async exportSnapshot(): Promise<Uint8Array> {
    const instance = await this.getInstance()
    this.emitLog('info', 'Exporting environment snapshot...')
    const snapshot = (await instance.export('.', {
      format: 'binary',
    })) as Uint8Array
    this.emitLog('info', 'Snapshot exported.')
    return snapshot
  }

  async mountRawSnapshot(data: Uint8Array) {
    const instance = await this.getInstance()
    await instance.mount(data)
    this.emitLog('info', 'Local snapshot mounted.')
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
        } catch {}
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
    const decoder = new TextDecoder()
    let currentLineBuffer = ''

    ;(async () => {
      try {
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

          const processLines = (linesToProc: string[]) => {
            for (const line of linesToProc) {
              const simplified = line.replace(
                toRegExp(RegexPatterns.EXCESSIVE_WHITESPACE),
                '    '
              )
              if (!options.silent) this.emitLog('info', simplified)
              options.onLog?.(simplified)
            }
          }

          if (!hasIncompleteAnsi) {
            currentLineBuffer = lines.pop() || ''
            processLines(lines)
          } else {
            const completeLines = lines.slice(0, -1)
            currentLineBuffer = lines[lines.length - 1]
            processLines(completeLines)
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
  }

  async readDirRecursive(
    dir: string,
    filter?: (path: string) => boolean,
    maxDepth = 20
  ): Promise<Record<string, string>> {
    const instance = await this.getInstance()
    const results: Record<string, string> = {}

    const read = async (currentPath: string, depth: number) => {
      if (depth > maxDepth) return

      try {
        const entries = await instance.fs.readdir(currentPath, {
          withFileTypes: true,
        })
        for (const entry of entries) {
          const fullPath = currentPath + '/' + entry.name

          // Skip common high-volume/hidden folders for performance
          if (
            entry.name === '.git' ||
            entry.name === '.husky' ||
            entry.name === '.bin'
          )
            continue

          if (entry.isDirectory()) {
            await read(fullPath, depth + 1)
          } else if (!filter || filter(fullPath)) {
            const content = await instance.fs.readFile(fullPath, 'utf8')
            // Ensure path starts with / for host-worker consistency
            const monacoPath = fullPath.startsWith('/')
              ? fullPath
              : '/' + fullPath
            results[monacoPath] = content
          }
        }
      } catch {}
    }

    await read(dir, 0)
    return results
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
) => webContainerService.spawnManaged(cmd, args, { onLog: onOutput })
export const operationQueue = {
  add: <T>(task: () => Promise<T>) =>
    playgroundStore.enqueue('Background Task', task),
}
