import { WebContainer, type WebContainerProcess } from '@webcontainer/api'
import { okAsync, ResultAsync } from 'neverthrow'

export class WebContainerService {
  private instance: WebContainer | null = null
  private bootPromise: Promise<WebContainer> | null = null

  getInstance(): ResultAsync<WebContainer, Error> {
    if (this.instance) return okAsync(this.instance)
    if (this.bootPromise) return ResultAsync.fromPromise(this.bootPromise, (e) => e as Error)

    this.bootPromise = WebContainer.boot().then(async instance => {
      this.instance = instance
      await instance.fs.writeFile('package.json', JSON.stringify({ name: 'ts-play', type: 'module' }))
      return instance
    })
    return ResultAsync.fromPromise(this.bootPromise, (e) => e as Error)
  }

  writeFile(path: string, content: string): ResultAsync<void, Error> {
    return this.getInstance().andThen(instance =>
      ResultAsync.fromPromise(instance.fs.writeFile(path, content), e => e as Error)
    )
  }

  writeFiles(files: Record<string, string>): ResultAsync<void, Error> {
    return this.getInstance().andThen(instance =>
      ResultAsync.fromPromise(
        (async () => {
          for (const [p, c] of Object.entries(files)) {
            await instance.fs.writeFile(p, c)
          }
        })(),
        e => e as Error
      )
    )
  }

  readFile(path: string): ResultAsync<string, Error> {
    return this.getInstance().andThen(instance =>
      ResultAsync.fromPromise(instance.fs.readFile(path, 'utf8'), e => e as Error)
    )
  }

  spawnManaged(cmd: string, args: string[], options: { onLog?: (l: string) => void } = {}): ResultAsync<WebContainerProcess, Error> {
    return this.getInstance().andThen(instance =>
      ResultAsync.fromPromise(
        (async () => {
          const proc = await instance.spawn(cmd, args)
          proc.output.pipeTo(new WritableStream({
            write: (chunk) => options.onLog?.(chunk)
          }))
          return proc
        })(),
        e => e as Error
      )
    )
  }
}

export const webContainerService = new WebContainerService()
export const runCommand = (cmd: string, args: string[], onLog: (d: string) => void) => webContainerService.spawnManaged(cmd, args, { onLog })
export const writeFiles = (files: Record<string, string>) => webContainerService.writeFiles(files)
export const readFile = (path: string) => webContainerService.readFile(path)
export const getWebContainer = () => webContainerService.getInstance()
