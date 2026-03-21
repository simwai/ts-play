import * as prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginTypescript from 'prettier/plugins/typescript';

export async function loadPrettier(): Promise<void> {}

async function formatCode(
  code: string,
  language: 'typescript' | 'javascript' | 'dts',
): Promise<string> {
  const parser = language === 'javascript' ? 'babel' : 'typescript';
  return await prettier.format(code, {
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
    trailingComma: 'all',
    bracketSpacing: true,
    arrowParens: 'always',
  });
}

export async function formatJson(code: string): Promise<string> {
  try {
    return await prettier.format(code, {
      parser: 'json5',
      plugins: [prettierPluginBabel, prettierPluginEstree],
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      quoteProps: 'preserve',
    });
  } catch {
    return code;
  }
}

export async function formatAllFiles(
  tsCode: string,
  jsCode: string,
  dtsCode: string,
): Promise<{
  tsCode: string;
  jsCode: string;
  dtsCode: string;
  errors: string[];
}> {
  const errors: string[] = [];
  let formattedTs = tsCode;
  let formattedJs = jsCode;
  let formattedDts = dtsCode;

  await Promise.all([
    formatCode(tsCode, 'typescript')
      .then((r) => {
        formattedTs = r;
      })
      .catch((error) => errors.push(`TS: ${error.message}`)),
    formatCode(jsCode, 'javascript')
      .then((r) => {
        formattedJs = r;
      })
      .catch((error) => errors.push(`JS: ${error.message}`)),
    formatCode(dtsCode, 'dts')
      .then((r) => {
        formattedDts = r;
      })
      .catch((error) => errors.push(`DTS: ${error.message}`)),
  ]);

  return {
    tsCode: formattedTs,
    jsCode: formattedJs,
    dtsCode: formattedDts,
    errors,
  };
}
