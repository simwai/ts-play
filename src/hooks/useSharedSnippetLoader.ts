import { useEffect } from 'react'
import { loadSharedSnippet } from '../lib/api'
import { decodeSharePayload } from '../lib/shareCodec'
import type { ConsoleMessageType } from '../lib/types'

type SnippetLoaderParams = {
  setTsCode: (code: string) => void
  setJsCode: (code: string) => void
  addMessage: (type: ConsoleMessageType, args: unknown[]) => void
}

export function useSharedSnippetLoader({
  setTsCode,
  setJsCode,
  addMessage,
}: SnippetLoaderParams) {
  useEffect(() => {
    ;(async () => {
      const parameters = new URLSearchParams(globalThis.location.search)
      const embedded =
        parameters.get('code') ||
        globalThis.location.hash.replace(/^#code=/, '')

      if (embedded) {
        try {
          const payload = await decodeSharePayload(embedded)
          setTsCode(payload.tsCode || '')
          setJsCode(payload.jsCode || '')
          addMessage('info', [
            'Loaded embedded share link (client-side, no server storage).',
          ])
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          addMessage('error', [`Failed to load embedded share link: ${msg}`])
        }
        return
      }

      const shareId = parameters.get('share')
      if (shareId) {
        try {
          const data = await loadSharedSnippet(shareId)
          if (data.success) {
            if (typeof data.tsCode === 'string') setTsCode(data.tsCode)
            if (typeof data.jsCode === 'string') setJsCode(data.jsCode)
            addMessage('info', [
              `✓ Loaded shared snippet (${data.remainingDays} days remaining)`,
            ])
            const url = new URL(globalThis.location.href)
            url.searchParams.delete('share')
            globalThis.history.replaceState({}, '', url.toString())
            return
          }
          addMessage('error', [
            `Failed to load shared snippet: ${
              typeof data.error === 'string' ? data.error : 'Unknown error'
            }`,
          ])
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          addMessage('error', [`Failed to load shared snippet: ${msg}`])
        }
      }
    })()
  }, [addMessage, setTsCode, setJsCode])
}
