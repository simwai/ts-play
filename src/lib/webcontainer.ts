import { WebContainer } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  if (!bootPromise) {
    bootPromise = WebContainer.boot().then((instance) => {
      webcontainerInstance = instance;
      return instance;
    });
  }

  return bootPromise;
}

export async function writeFiles(files: Record<string, string>) {
  const instance = await getWebContainer();
  
  const fileSystemTree: Record<string, any> = {};
  for (const [path, content] of Object.entries(files)) {
    fileSystemTree[path] = {
      file: {
        contents: content,
      },
    };
  }

  await instance.mount(fileSystemTree);
}

export async function runCommand(cmd: string, args: string[], onOutput: (data: string) => void) {
  const instance = await getWebContainer();
  const process = await instance.spawn(cmd, args);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput(data);
      },
    })
  );

  return process.exit;
}
