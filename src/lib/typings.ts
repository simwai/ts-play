import type { InstalledPackage } from '../components/PackageManager';
import { readFile } from './webcontainer';

function libName(pkg: InstalledPackage, entry = 'index') {
  const safe = pkg.name.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@types/${safe}/${entry}.d.ts`;
}

function ambientModuleName(pkg: InstalledPackage, entry = 'index') {
  const safe = pkg.name.replace(/[^a-zA-Z0-9_]/g, '_');
  return `@virtual/${safe}/${entry}.d.ts`;
}

function stripLeadingComments(content: string) {
  return content.replace(/^\/\/.*$/gm, '').trim();
}

function sanitizeDeclarationContent(content: string) {
  return content
    // Convert CommonJS export assignments to ES default exports
    .replace(/^\s*export\s*=\s+/gm, 'export default ')
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
      try {
        // Try to read package.json to find types from WebContainer
        const pkgJsonRaw = await readFile(`node_modules/${pkg.name}/package.json`);
        if (!pkgJsonRaw) return;
        
        const pkgJson = JSON.parse(pkgJsonRaw);
        const typesPath = pkgJson.types || pkgJson.typings || 'index.d.ts';
        
        const text = await readFile(`node_modules/${pkg.name}/${typesPath}`);
        if (!text) return;

        const looksLikeDeclaration = /\bdeclare\b|\binterface\b|\btype\b|\bexport\b/.test(text);
        if (!looksLikeDeclaration) return;

        const ambientBare = wrapAmbientModule(pkg.name, text);
        const ambientUrl = wrapAmbientModule(pkg.url, text);

        if (ambientBare) {
          libs[ambientModuleName(pkg, 'index')] = ambientBare;
        }
        if (ambientUrl) {
          libs[libName(pkg, `index__url`)] = ambientUrl;
        }
      } catch (e) {
        console.warn(`Failed to load typings for ${pkg.name}:`, e);
      }
    })
  );

  return libs;
}
