import { useCallback, useRef, useEffect, useState } from 'react'
import { writeTextWithFallback } from '../lib/clipboard'
import { playgroundStore } from '../lib/state-manager'

export function useClipboardActions({
  activeTab,
  tsCode,
  jsCode,
  dtsCode,
  setTsCode,
  setJsCode,
  setDtsCode,
}: {
  activeTab: 'ts' | 'js' | 'dts'
  tsCode: string
  jsCode: string
  dtsCode: string
  setTsCode: (code: string) => void
  setJsCode: (code: string) => void
  setDtsCode: (code: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopyAll = useCallback(async () => {
    let content = ''
    if (activeTab === 'ts') content = tsCode
    else if (activeTab === 'js') content = jsCode
    else content = dtsCode

    await writeTextWithFallback(content)
    setCopied(true)
    playgroundStore.addToast('info', 'Copied to clipboard')
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }, [activeTab, tsCode, jsCode, dtsCode])

  const handleDeleteAll = useCallback(() => {
    if (activeTab === 'ts') setTsCode('')
    else if (activeTab === 'js') setJsCode('')
    else setDtsCode('')
    playgroundStore.addToast('info', 'Cleared current editor')
  }, [activeTab, setTsCode, setJsCode, setDtsCode])

  return { copied, handleCopyAll, handleDeleteAll }
}
