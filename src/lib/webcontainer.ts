import { WebContainer, type WebContainerProcess } from '@webcontainer/api'

let webcontainerInstance: WebContainer | undefined
let bootPromise: Promise<WebContainer> | undefined

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
  const instance = await getWebContainer()

  for (const [path, contents] of Object.entries(files)) {
    await instance.fs.writeFile(path, contents)
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
