import * as prettier from 'prettier/standalone'
import * as prettierPluginBabel from 'prettier/plugins/babel'
import * as prettierPluginEstree from 'prettier/plugins/estree'
import * as prettierPluginTypescript from 'prettier/plugins/typescript'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function formatCode(
  code: string,
  language: 'typescript' | 'javascript' | 'dts'
): Promise<string> {
  const parser = language === 'javascript' ? 'babel' : 'typescript'

  const formatted = await prettier.format(code, {
    parser,
    plugins: [
      prettierPluginBabel,
      prettierPluginEstree,
      prettierPluginTypescript,
    ],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  })

  return formatted
}

export async function formatJson(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: 'json5', // json5 safely supports comments and trailing commas
      plugins: [prettierPluginBabel, prettierPluginEstree],
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      quoteProps: 'preserve',
      trailingComma: 'none', // Ensures Prettier doesn't strip the quotes we just added
    })
  } catch {
    return code // Fallback to raw if formatting fails
  }
}

export async function formatAllFiles(
  tsCode: string,
  jsCode: string,
  dtsCode: string
): Promise<{
  tsCode: string
  jsCode: string
  dtsCode: string
  errors: string[]
}> {
  const errors: string[] = []

  let formattedTs = tsCode
  let formattedJs = jsCode
  let formattedDts = dtsCode

  await Promise.all([
    (async () => {
      try {
        formattedTs = await formatCode(tsCode, 'typescript')
      } catch (error) {
        errors.push(`TS: ${getErrorMessage(error)}`)
      }
    })(),
    (async () => {
      try {
        formattedJs = await formatCode(jsCode, 'javascript')
      } catch (error) {
        errors.push(`JS: ${getErrorMessage(error)}`)
      }
    })(),
    (async () => {
      try {
        formattedDts = await formatCode(dtsCode, 'dts')
      } catch (error) {
        errors.push(`DTS: ${getErrorMessage(error)}`)
      }
    })(),
  ])

  return {
    tsCode: formattedTs,
    jsCode: formattedJs,
    dtsCode: formattedDts,
    errors,
  }
}
