import * as prettier from 'prettier/standalone'
import * as prettierPluginBabel from 'prettier/plugins/babel'
import * as prettierPluginEstree from 'prettier/plugins/estree'
import * as prettierPluginTypescript from 'prettier/plugins/typescript'

export async function loadPrettier(): Promise<void> {
  // Prettier is now bundled locally, no need to load from CDN
}

export async function formatCode(
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
      quoteProps: 'preserve', trailingComma: 'none', // Ensures Prettier doesn't strip the quotes we just added
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
    formatCode(tsCode, 'typescript')
      .then((r) => {
        formattedTs = r
      })
      .catch((error) => errors.push(`TS: ${error.message}`)),

    formatCode(jsCode, 'javascript')
      .then((r) => {
        formattedJs = r
      })
      .catch((error) => errors.push(`JS: ${error.message}`)),

    formatCode(dtsCode, 'dts')
      .then((r) => {
        formattedDts = r
      })
      .catch((error) => errors.push(`DTS: ${error.message}`)),
  ])

  return {
    tsCode: formattedTs,
    jsCode: formattedJs,
    dtsCode: formattedDts,
    errors,
  }
}
