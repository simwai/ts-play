import type { InstalledPackage } from '../components/PackageManager';

function libName(pkg: InstalledPackage, entry = 'index') {
  const safe = pkg.name.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@types/${safe}/${entry}.d.ts`;
}

function ambientModuleName(pkg: InstalledPackage, entry = 'index') {
  const safe = pkg.name.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@virtual/${safe}/${entry}.d.ts`;
}

async function fetchText(url: string) {
  const res = await fetch(url);
  if (!res.ok) return '';
  return res.text();
}

function stripLeadingComments(content: string) {
  return content.replace(/^\/\/.*$/gm, '').trim();
}

function sanitizeDeclarationContent(content: string) {
  return content
    .replace(/^\s*export\s*=\s+/gm, 'const __default__: ')
    .replace(/^\s*import\s+type\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};\s*$/gm, '')
    .trim();
}

function wrapAmbientModule(moduleName: string, content: string) {
  const body = sanitizeDeclarationContent(stripLeadingComments(content));
  if (!body) return '';
  // If the file is already ambient/module-declared, leave it as-is.
  if (/declare\s+module\s+['"][^'"]+['"]/.test(body)) return body;
  return `declare module '${moduleName}' {\n${body}\n}`;
}

export async function loadPackageTypings(packages: InstalledPackage[]) {
  const libs: Record<string, string> = {};

  await Promise.all(
    packages.map(async (pkg) => {
      // Use esm.sh to automatically resolve types for the package
      const url = `https://esm.sh/${pkg.name}?dts`;

      try {
        const text = await fetchText(url);
        const entry = 'index';

        const looksLikeDeclaration = /\bdeclare\b|\binterface\b|\btype\b|\bexport\b/.test(text) && !/^<!doctype html/i.test(text.trim());

        if (!text || text.includes('404') || text.includes('Not Found') || !looksLikeDeclaration) {
          return; // Skip if we couldn't get valid typings
        }

        const ambientBare = wrapAmbientModule(pkg.name, text);
        const ambientUrl = wrapAmbientModule(pkg.url, text);

        if (ambientBare) {
          libs[ambientModuleName(pkg, entry)] = ambientBare;
        }
        if (ambientUrl) {
          libs[libName(pkg, `${entry}__url`)] = ambientUrl;
        }
      } catch (e) {
        console.warn(`Failed to load typings for ${pkg.name}:`, e);
      }
    })
  );

  return libs;
}
