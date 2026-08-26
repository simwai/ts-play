import { describe, it, expect } from 'vitest'
import { encodeSharePayload, decodeSharePayload } from './shareCodec'

describe('shareCodec round-trip', () => {
  it('round-trips a payload through the gz token format', async () => {
    const payload = {
      tsCode: 'const greeting: string = "hello";\nconsole.log(greeting);',
      jsCode: 'var greeting = "hello";\nconsole.log(greeting);',
      packages: [{ name: 'lodash-es' }],
    }

    const token = await encodeSharePayload(payload)
    const kind = token.split('.', 1)[0]
    expect(['gz', 'raw']).toContain(kind)

    const decoded = await decodeSharePayload(token)
    expect(decoded).toEqual(payload)
  })

  it('decodes hand-built raw tokens verbatim', async () => {
    const payload = { tsCode: 'let x = 1;', jsCode: '', packages: [] }
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const rawToken =
      'raw.' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_')

    const decoded = await decodeSharePayload(rawToken)
    expect(decoded).toEqual(payload)
  })

  it('rejects unknown token kinds and malformed tokens', async () => {
    await expect(decodeSharePayload('zip.AAAA')).rejects.toThrow(
      'Unknown embedded share format'
    )
    await expect(decodeSharePayload('noperiod')).rejects.toThrow(
      'Invalid embedded share link'
    )
  })
})
