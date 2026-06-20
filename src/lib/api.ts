import { encodeSharePayload } from './shareCodec'
import type { InstalledPackage } from '../components/PackageManager'

function getApiCandidates(path: string) {
  const normalized = path.replace(/^\/+/, '')
  const base = new URL(document.baseURI || globalThis.location.href)
  const currentDir = new URL('./', globalThis.location.href)
  const candidates = [
    new URL(normalized, base).toString(),
    new URL(normalized, currentDir).toString(),
    `${globalThis.location.origin}/${normalized}`,
  ]
  return [...new Set(candidates)]
}

export function getApiUrl(path: string) {
  return new URL(path.replace(/^\//, ''), document.baseURI).toString()
}

export async function fetchApiJson(path: string, init?: RequestInit) {
  const candidates = getApiCandidates(path)
  let lastError: Error | undefined = undefined

  for (const url of candidates) {
    try {
      const res = await fetch(url, init)
      const text = await res.text()
      let data: any = undefined
      try {
        data = JSON.parse(text)
      } catch {
        const preview = text.slice(0, 300).replaceAll('\n', ' ')
        if (!res.ok) {
          lastError = new Error(
            `Share API failed (${res.status} ${res.statusText}) at ${url}. Raw response: ${preview}...`
          )
          continue
        }

        lastError = new Error(
          `Share API returned invalid JSON at ${url}. Raw response: ${preview}...`
        )
        continue
      }

      if (!res.ok) {
        lastError = new Error(
          data?.error || `Share API failed (${res.status}).`
        )
        continue
      }

      return data
    } catch (error) {
      lastError = error as Error
    }
  }

  throw (
    lastError ??
    new Error(
      'Share service unavailable. Ensure the PHP API is served correctly.'
    )
  )
}

export async function parseJsonResponse(res: Response) {
  const text = await res.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    const preview = text.slice(0, 300).replaceAll('\n', ' ')
    throw new Error(
      res.ok
        ? `Share API returned invalid JSON. Raw response: ${preview}...`
        : `Share API failed (${res.status}). Raw response: ${preview}...`
    )
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`)
  }

  return data
}

export type SharePayload = {
  tsCode: string
  jsCode: string
  packages: InstalledPackage[]
}

export async function shareSnippet(payload: SharePayload) {
  try {
    const data = await fetchApiJson('api/share.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (data.success) {
      return {
        type: 'server' as const,
        id: data.id as string,
        ttlDays: (data.ttlDays ?? data.expires ?? 7) as number,
      }
    }

    throw new Error(data.error || 'Share API returned an error')
  } catch (error) {
    const token = await encodeSharePayload(payload)
    return { type: 'embedded' as const, token, error: error as Error }
  }
}

export async function loadSharedSnippet(id: string) {
  const res = await fetch(getApiUrl(`api/get.php?id=${encodeURIComponent(id)}`))
  return parseJsonResponse(res)
}

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
