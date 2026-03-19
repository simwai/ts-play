import { useEffect, useState, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import type { TSDiagnostic } from '../lib/types'

const EMPTY_LIBS = {}

export function useTSDiagnostics(
  code: string,
  isTypeScript: boolean,
  extraLibs: Record<string, string> = EMPTY_LIBS
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastUpdateRef = useRef<{ code: string; libs: Record<string, string> | null }>(
    { code: '', libs: null }
  )

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([])
      return
    }

    if (timerRef.current) globalThis.clearTimeout(timerRef.current)

    timerRef.current = globalThis.setTimeout(async () => {
      if (lastUpdateRef.current.code === code && lastUpdateRef.current.libs === extraLibs) {
         return
      }

      if (code.length > 50_000) return

      try {
        await workerClient.updateFile('main.ts', code)

        if (lastUpdateRef.current.libs !== extraLibs) {
          await workerClient.updateExtraLibs(extraLibs)
        }

        const diags = await workerClient.getDiagnostics()
        setDiagnostics(diags)
        lastUpdateRef.current = { code, libs: extraLibs }
      } catch (error) {
        // Silent
      }
    }, 400)

    return () => {
      if (timerRef.current) globalThis.clearTimeout(timerRef.current)
    }
  }, [code, isTypeScript, extraLibs])

  return diagnostics
}
