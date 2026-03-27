import { webContainerService } from './webcontainer'

/**
 * Orchestrates the formatting and linting of all playground files using Biome
 * running within the WebContainer environment.
 */
export async function formatAllFiles(tsCode: string, jsCode: string, dtsCode: string) {
  // Write the current TS code to a temporary file in the container
  await webContainerService.writeFile('temp.ts', tsCode)

  // Wait for the environment to be ready (Biome must be installed)
  await webContainerService.getEnvReady()

  // Execute Biome within the container (format + lint + organize imports)
  const proc = await webContainerService.spawnManaged(
    'npx',
    ['biome', 'check', '--write', 'temp.ts'],
    { silent: true },
  )
  const exitCode = await (proc as any).exit

  if (exitCode === 0) {
    // Read the formatted content back
    const formattedTs = await webContainerService.readFile('temp.ts')
    return { tsCode: formattedTs, jsCode, dtsCode }
  }

  // Return original code if formatting fails
  return { tsCode, jsCode, dtsCode }
}

/**
 * Standard JSON formatter for configuration files using Biome in the container.
 */
export async function formatJson(json: string) {
  try {
    // Write the JSON to a temporary file
    await webContainerService.writeFile('temp.json', json)

    // Run Biome formatter
    const proc = await webContainerService.spawnManaged(
      'npx',
      ['biome', 'format', '--write', 'temp.json'],
      { silent: true },
    )
    const exitCode = await (proc as any).exit

    if (exitCode === 0) {
      return await webContainerService.readFile('temp.json')
    }

    // Fallback to basic stringify if Biome fails
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

/**
 * Biome is managed within the WebContainer, so this is a no-op on the main thread.
 */
export async function loadBiome() {
  return Promise.resolve()
}
