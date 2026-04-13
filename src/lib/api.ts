export async function checkNpmPackage(pkgName: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
      {
        method: 'HEAD',
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export function getTypesPackageName(pkgName: string): string {
  if (pkgName.startsWith('@')) {
    const [scope, name] = pkgName.slice(1).split('/')
    return `@types/${scope}__${name}`
  }
  return `@types/${pkgName}`
}
