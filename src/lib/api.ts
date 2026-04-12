import { encodeSharePayload } from './shareCodec'

export const getShareUrl = async (tsCode: string, jsCode: string) => {
  const payload = await encodeSharePayload({ tsCode, jsCode, packages: [] })
  const url = new URL(globalThis.location.href)
  url.searchParams.set('share', payload)
  return url.toString()
}

export const checkNpmPackage = async (name: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}/latest`)
    return res.ok
  } catch {
    return false
  }
}

export const getTypesPackageName = (name: string): string => {
  if (name.startsWith('@')) {
    return `@types/${name.slice(1).replace('/', '__')}`
  }
  return `@types/${name}`
}
