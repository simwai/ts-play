import { RegexPatterns, toRegExp } from './regex'

type SharePayload = {
  tsCode: string
  jsCode: string
  packages: unknown[]
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x80_00
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  const base64PaddingRegex = toRegExp(RegexPatterns.BASE64_PADDING)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(base64PaddingRegex, '')
}

function fromBase64Url(input: string) {
  const targetLength = Math.ceil(input.length / 4) * 4
  const padded = input
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(targetLength, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function gzip(input: Uint8Array) {
  const hasCompressionStream = typeof CompressionStream === 'function'
  if (!hasCompressionStream) return null
  const stream = new Blob([Uint8Array.from(input)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

async function gunzip(input: Uint8Array) {
  const hasDecompressionStream = typeof DecompressionStream === 'function'
  if (!hasDecompressionStream) return null
  const stream = new Blob([Uint8Array.from(input)])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export async function encodeSharePayload(payload: SharePayload) {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  const compressed = await gzip(bytes)

  if (compressed) {
    return `gz.${toBase64Url(compressed)}`
  }

  return `raw.${toBase64Url(bytes)}`
}

export async function decodeSharePayload(token: string): Promise<SharePayload> {
  const [kind, data] = token.split('.', 2)
  const isInvalidToken = !kind || !data
  if (isInvalidToken) throw new Error('Invalid embedded share link')

  const bytes = fromBase64Url(data)
  let decoded: Uint8Array | undefined

  if (kind === 'gz') {
    decoded = (await gunzip(bytes)) ?? undefined
    const isDecodingSupported = Boolean(decoded)
    if (!isDecodingSupported) {
      throw new Error('This browser cannot decode compressed share links')
    }
  } else if (kind === 'raw') {
    decoded = bytes
  } else {
    throw new Error('Unknown embedded share format')
  }

  const json = new TextDecoder().decode(decoded)
  return JSON.parse(json) as SharePayload
}
