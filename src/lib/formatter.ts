import { webContainerService } from './webcontainer';

/**
 * Orchestrates the formatting of all playground files using Prettier
 * running within the WebContainer environment.
 */
export async function formatAllFiles(
  tsCode: string,
  jsCode: string,
  dtsCode: string,
) {
  // Write the current TS code to a temporary file in the container
  await webContainerService.writeFile('temp.ts', tsCode);

  // Wait for the environment to be ready (Prettier must be installed)
  await webContainerService.getEnvReady();

  // Execute Prettier within the container
  const proc = await webContainerService.spawnManaged(
    'npx',
    ['prettier', '--write', 'temp.ts'],
    { silent: true },
  );
  const exitCode = await (proc as any).exit;

  if (exitCode === 0) {
    // Read the formatted content back
    const formattedTs = await webContainerService.readFile('temp.ts');
    return { tsCode: formattedTs, jsCode, dtsCode };
  }

  // Return original code if formatting fails
  return { tsCode, jsCode, dtsCode };
}
