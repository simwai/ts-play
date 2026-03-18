import { WebContainer, type WebContainerProcess } from '@webcontainer/api'

let webcontainerInstance: WebContainer | undefined
let bootPromise: Promise<WebContainer> | undefined

export async function getWebContainer(): Promise<WebContainer> {
  if (!globalThis.crossOriginIsolated) {
    throw new Error(
      'Browser is not cross-origin isolated. WebContainers require COOP/COEP headers and a secure context (HTTPS or localhost).'
    )
  }

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
  const instance = await getWebContainer()

  const fileSystemTree: Record<string, any> = {}
  for (const [path, content] of Object.entries(files)) {
    fileSystemTree[path] = {
      file: {
        contents: content,
      },
    }
  }

  await instance.mount(fileSystemTree)
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
