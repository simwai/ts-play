import { useEffect, useState, useRef } from 'react'
import { workerClient } from '../lib/workerClient'

export type TSDiagnostic = {
  start: number
  length: number
  message: string
  category: 'error' | 'warning'
  line: number
  character: number
}

const EMPTY_LIBS = {}

export function useTSDiagnostics(
  code: string,
  isTypeScript: boolean,
  extraLibs: Record<string, string> = EMPTY_LIBS
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastUpdateRef = useRef<{ code: string; libCount: number }>({
    code: '',
    libCount: 0,
  })

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([])
      return
    }

    if (timerRef.current) globalThis.clearTimeout(timerRef.current)

    timerRef.current = globalThis.setTimeout(async () => {
      const libCount = Object.keys(extraLibs).length

      // Basic change check
      if (
        lastUpdateRef.current.code === code &&
        lastUpdateRef.current.libCount === libCount
      ) {
        return
      }

      if (code.length > 50_000) return

      try {
        await workerClient.updateFile('main.ts', code)

        if (lastUpdateRef.current.libCount !== libCount) {
          await workerClient.updateExtraLibs(extraLibs)
        }

        const diags = await workerClient.getDiagnostics()
        setDiagnostics(diags)
        lastUpdateRef.current = { code, libCount }
      } catch (error) {
        // Silent error handling for transient worker issues
      }
    }, 400)

    return () => {
      if (timerRef.current) globalThis.clearTimeout(timerRef.current)
    }
  }, [code, isTypeScript, extraLibs])

  return diagnostics
}
