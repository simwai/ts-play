import { useCallback, useState } from 'react'
import { shareSnippet, loadSharedSnippet } from '../lib/api'
import { decodeSharePayload } from '../lib/shareCodec'
import { buildShareServerUrl, buildEmbeddedShareUrl } from '../lib/shareUrl'
import { writeTextWithFallback } from '../lib/clipboard'
import { toErrorMessage } from '../lib/errors'
import { playgroundStore } from '../lib/state-manager'
import type { InstalledPackage } from '../components/PackageManager'

export function useShareFlow({
  tsCode,
  jsCode,
  installedPackages,
}: {
  tsCode: string
  jsCode: string
  installedPackages: InstalledPackage[]
}) {
  const [sharing, setSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  const handleShare = useCallback(async () => {
    setSharing(true)
    playgroundStore.enqueue('Share', async () => {
      try {
        const result = await shareSnippet({
          tsCode,
          jsCode,
          packages: installedPackages,
        })
        if (result.type === 'server') {
          const url = buildShareServerUrl(result.id)
          await writeTextWithFallback(url)
          setShareSuccess(true)
          playgroundStore.addToast(
            'success',
            `Share link copied! Expires in ${result.ttlDays} days`
          )
        } else {
          const url = buildEmbeddedShareUrl(result.token)
          await writeTextWithFallback(url)
          setShareSuccess(true)
          playgroundStore.addToast(
            'info',
            'Copied embedded compressed link (PHP share unavailable)'
          )
        }
        setTimeout(() => setShareSuccess(false), 2000)
      } catch (error) {
        playgroundStore.addToast(
          'error',
          `Failed to share: ${toErrorMessage(error)}`
        )
      } finally {
        setSharing(false)
      }
    })
  }, [tsCode, jsCode, installedPackages])

  return { sharing, shareSuccess, handleShare }
}

export function useEmbeddedShareLoader({
  setTsCode,
  setJsCode,
  addMessage,
}: {
  setTsCode: (code: string) => void
  setJsCode: (code: string) => void
  addMessage: (type: string, args: unknown[]) => void
}) {
  // Load embedded share from URL on mount
  // This should be called in a useEffect in the parent component
  return { decodeSharePayload, loadSharedSnippet }
}
