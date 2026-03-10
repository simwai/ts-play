import * as prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginTypescript from 'prettier/plugins/typescript';

export async function loadPrettier(): Promise<void> {
  // Prettier is now bundled locally, no need to load from CDN
}

export async function formatCode(
  code: string,
  language: 'typescript' | 'javascript' | 'dts'
): Promise<string> {
  const parser = language === 'javascript' ? 'babel' : 'typescript';

  const formatted = await prettier.format(code, {
    parser,
    plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginTypescript],
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  });

  return formatted;
}

export async function formatAllFiles(
  tsCode: string,
  jsCode: string,
  dtsCode: string
): Promise<{ tsCode: string; jsCode: string; dtsCode: string; errors: string[] }> {
  const errors: string[] = [];

  let formattedTs = tsCode;
  let formattedJs = jsCode;
  let formattedDts = dtsCode;

  await Promise.all([
    formatCode(tsCode, 'typescript')
      .then(r => { formattedTs = r; })
      .catch(e => errors.push(`TS: ${e.message}`)),

    formatCode(jsCode, 'javascript')
      .then(r => { formattedJs = r; })
      .catch(e => errors.push(`JS: ${e.message}`)),

    formatCode(dtsCode, 'dts')
      .then(r => { formattedDts = r; })
      .catch(e => errors.push(`DTS: ${e.message}`)),
  ]);

  return { tsCode: formattedTs, jsCode: formattedJs, dtsCode: formattedDts, errors };
}
