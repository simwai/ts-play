type SharePayload = {
  tsCode: string
  jsCode: string
  packages: unknown[]
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x80_00
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(/=+$/g, '')
}

async function gzip(input: Uint8Array) {
  if (typeof CompressionStream !== 'function') return null
  const stream = new Blob([Uint8Array.from(input)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
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
