/**
 * Browser-based code formatter using Prettier loaded from CDN.
 * Formats TypeScript, JavaScript, and .d.ts files.
 */

let prettierLoaded = false;
let prettierPromise: Promise<void> | null = null;

declare global {
  interface Window {
    prettier: any;
    prettierPlugins: any;
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

export async function loadPrettier(): Promise<void> {
  if (prettierLoaded) return;
  if (prettierPromise) return prettierPromise;

  prettierPromise = (async () => {
    const CDN = 'https://cdn.jsdelivr.net/npm/prettier@3.3.3/';
    await loadScript(`${CDN}standalone.js`, 'prettier-standalone');
    await loadScript(`${CDN}plugins/babel.js`, 'prettier-babel');
    await loadScript(`${CDN}plugins/estree.js`, 'prettier-estree');
    await loadScript(`${CDN}plugins/typescript.js`, 'prettier-typescript');
    prettierLoaded = true;
  })();

  return prettierPromise;
}

export async function formatCode(
  code: string,
  language: 'typescript' | 'javascript' | 'dts'
): Promise<string> {
  await loadPrettier();

  const prettier = window.prettier;
  const plugins = window.prettierPlugins;

  if (!prettier || !plugins) {
    throw new Error('Prettier failed to load');
  }

  const parser = language === 'javascript' ? 'babel' : 'typescript';

  const formatted = await prettier.format(code, {
    parser,
    plugins: [plugins.babel, plugins.estree, plugins.typescript],
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
  await loadPrettier();

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
