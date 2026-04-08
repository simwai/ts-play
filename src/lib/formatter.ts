import type { BuiltInParserName } from 'prettier'
import { webContainerService } from './webcontainer'

let prettier: any = null
let prettierPlugins: any[] = []
let prettierPromise: Promise<void> | null = null

export async function loadPrettier() {
  if (prettier) return
  if (prettierPromise) return prettierPromise

  prettierPromise = (async () => {
    try {
      // Lazy load prettier to avoid blocking the main thread during initial load
      const [p, ...plugins] = await Promise.all([
        import('prettier/standalone'),
        import('prettier/plugins/estree'),
        import('prettier/plugins/typescript'),
        import('prettier/plugins/postcss'),
        import('prettier/plugins/babel'),
      ])
      prettier = p.default || p
      prettierPlugins = plugins.map((mod) => mod.default || mod)
    } catch (error) {
      console.warn('Prettier load failed:', error)
    }
  })()

  return prettierPromise
}

export async function formatCode(
  code: string,
  parser: BuiltInParserName = 'typescript'
): Promise<string> {
  await loadPrettier()
  if (!prettier) return code

  try {
    return await prettier.format(code, {
      parser,
      plugins: prettierPlugins,
      semi: false,
      singleQuote: true,
      trailingComma: 'none',
      printWidth: 80,
    })
  } catch (error) {
    console.warn('Formatting error:', error)
    return code
  }
}

export async function formatJson(json: string): Promise<string> {
  return formatCode(json, 'json')
}

export async function formatAllFiles(
  ts: string,
  js: string,
  dts: string
): Promise<{ ts: string; js: string; dts: string; errors: string[] }> {
  const errors: string[] = []

  const format = async (code: string, parser: BuiltInParserName) => {
    try {
      return await formatCode(code, parser)
    } catch (e: any) {
      errors.push(e.message)
      return code
    }
  }

  const [fTs, fJs, fDts] = await Promise.all([
    format(ts, 'typescript'),
    format(js, 'typescript'),
    format(dts, 'typescript'),
  ])

  // Also format in WebContainer if prettier is available there
  try {
    await webContainerService.spawnManaged(
      'npx',
      ['prettier', '--write', 'index.ts', 'index.js'],
      { onLog: () => {} }
    )
  } catch {
    /* ignore */
  }

  return { ts: fTs, js: fJs, dts: fDts, errors }
}
