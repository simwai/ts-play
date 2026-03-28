import { WebContainer, type WebContainerProcess } from '@webcontainer/api'

let webcontainerInstance: WebContainer | undefined
let bootPromise: Promise<WebContainer> | undefined

class OperationQueue {
  private queue: (() => Promise<any>)[] = []
  private isProcessing = false

  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      this.startProcessing()
    })
  }

  private async startProcessing() {
    if (this.isProcessing) return
    this.isProcessing = true
    while (this.queue.length > 0) {
      const operation = this.queue.shift()
      if (operation) {
        try {
          await operation()
        } catch (e) {
          console.error('Queue operation failed:', e)
        }
      }
    }
    this.isProcessing = false
  }
}

export const operationQueue = new OperationQueue()

export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) {
    return webcontainerInstance
  }

  bootPromise ||= WebContainer.boot().then((instance) => {
    webcontainerInstance = instance
    return instance
  })

  return bootPromise
}

export async function writeFiles(files: Record<string, string>) {
  return operationQueue.add(async () => {
    const instance = await getWebContainer()
    for (const [path, contents] of Object.entries(files)) {
      await instance.fs.writeFile(path, contents)
    }
  })
}

export async function readFile(path: string): Promise<string> {
  const instance = await getWebContainer()
  try {
    const content = await instance.fs.readFile(path, 'utf8')
    return content
  } catch {
    return ''
  }
}

export async function runCommand(
  cmd: string,
  args: string[],
  onOutput: (data: string) => void
): Promise<{ exit: Promise<number>; process: WebContainerProcess }> {
  const instance = await getWebContainer()
  const process = await instance.spawn(cmd, args)

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput(data)
      },
    })
  )

  return { exit: process.exit, process }
}
