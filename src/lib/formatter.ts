import { runCommand, getWebContainer } from './webcontainer';

export async function formatAllFiles(tsCode: string, jsCode: string, dtsCode: string) {
  const instance = await getWebContainer();

  // Write to temporary files for Prettier to process
  await instance.fs.writeFile('temp.ts', tsCode);

  // Run Prettier inside WebContainer
  const { exit } = await runCommand('npx', ['prettier', '--write', 'temp.ts'], () => {});
  const exitCode = await exit;

  if (exitCode === 0) {
    const formattedTs = await instance.fs.readFile('temp.ts', 'utf8');
    return { tsCode: formattedTs, jsCode, dtsCode };
  }

  return { tsCode, jsCode, dtsCode };
}

// Keep formatJson as is or refactor later if needed
export async function formatJson(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export async function loadPrettier() {
  // Prettier is now loaded within the WebContainer
  return Promise.resolve();
}
