import { useState, useEffect, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import type { TSDiagnostic } from '../lib/types'

export function useTSDiagnostics(
  code: string,
  enabled: boolean,
  extraLibs: Record<string, string>
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setDiagnostics([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      // Sync file first
      await workerClient.updateFile('/main.ts', code)

      const res = await workerClient.getDiagnostics()
      if (res.isOk()) {
          setDiagnostics(res.value)
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code, enabled, extraLibs])

  return diagnostics
}
