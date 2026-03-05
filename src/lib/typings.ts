import type { InstalledPackage, CdnProvider } from '../components/PackageManager';

const TYPINGS_CDN: Record<CdnProvider, (name: string, version: string) => string> = {
  'esm.sh': (name, version) => `https://esm.sh/${name}@${version}?dts`,
  'unpkg': (name, version) => `https://unpkg.com/${name}@${version}/?dts`,
  'jsdelivr': (name, version) => `https://cdn.jsdelivr.net/npm/${name}@${version}/+dts`,
};

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

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
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

async function resolveTypesFromPackageJson(pkg: InstalledPackage) {
  const base = pkg.cdn === 'unpkg'
    ? `https://unpkg.com/${pkg.name}@${pkg.version || 'latest'}`
    : pkg.cdn === 'jsdelivr'
      ? `https://cdn.jsdelivr.net/npm/${pkg.name}@${pkg.version || 'latest'}`
      : `https://registry.npmjs.org/${pkg.name.replace('/', '%2f')}`;

  if (pkg.cdn === 'esm.sh') {
    const npmMeta = await fetchJson(base);
    const latestVersion = pkg.version || npmMeta?.['dist-tags']?.latest;
    const manifest = latestVersion ? npmMeta?.versions?.[latestVersion] : null;
    const typesEntry = manifest?.types || manifest?.typings;
    if (!typesEntry || !latestVersion) return null;
    const rawUrl = `https://unpkg.com/${pkg.name}@${latestVersion}/${String(typesEntry).replace(/^\.\//, '')}`;
    return { entry: String(typesEntry), text: await fetchText(rawUrl) };
  }

  const pkgJsonUrl = `${base}/package.json`;
  const pkgJson = await fetchJson(pkgJsonUrl);
  const typesEntry = pkgJson?.types || pkgJson?.typings;
  if (!typesEntry) return null;
  const typesUrl = `${base}/${String(typesEntry).replace(/^\.\//, '')}`;
  return { entry: String(typesEntry), text: await fetchText(typesUrl) };
}

export async function loadPackageTypings(packages: InstalledPackage[]) {
  const libs: Record<string, string> = {};

  await Promise.all(
    packages.map(async (pkg) => {
      const url = TYPINGS_CDN[pkg.cdn]?.(pkg.name, pkg.version || 'latest');
      if (!url) return;

      try {
        let text = await fetchText(url);
        let entry = 'index';

        // Some CDN ?dts endpoints return JS/proxy text instead of useful .d.ts content.
        const looksLikeDeclaration = /\bdeclare\b|\binterface\b|\btype\b|\bexport\b/.test(text) && !/^<!doctype html/i.test(text.trim());

        if (!text || text.includes('404') || text.includes('Not Found') || !looksLikeDeclaration) {
          const resolved = await resolveTypesFromPackageJson(pkg);
          if (!resolved?.text) return;
          text = resolved.text;
          entry = resolved.entry.replace(/\.d\.ts$/, '').replace(/^\.\//, '').replace(/\//g, '_');
        }

        const ambientBare = wrapAmbientModule(pkg.name, text);
        const ambientUrl = wrapAmbientModule(pkg.url, text);

        if (ambientBare) {
          libs[ambientModuleName(pkg, entry)] = ambientBare;
        }
        if (ambientUrl) {
          libs[libName(pkg, `${entry}__url`)] = ambientUrl;
        }
      } catch {
        // ignore typing load failures
      }
    })
  );

  return libs;
}
