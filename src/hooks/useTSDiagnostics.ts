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
  const lastLibsRef = useRef<Record<string, string>>(EMPTY_LIBS)
  const lastCodeRef = useRef<string>('')

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([])
      return
    }

    if (timerRef.current) globalThis.clearTimeout(timerRef.current)

    timerRef.current = globalThis.setTimeout(async () => {
      if (code.length > 20_000) return

      try {
        // Sync code to worker
        await workerClient.updateFile('/main.ts', code)
        lastCodeRef.current = code

        // Performance optimization: Only send the huge node_modules object
        // to the worker if it actually changed (after an npm install)
        if (lastLibsRef.current !== extraLibs) {
          await workerClient.updateExtraLibs(extraLibs)
          lastLibsRef.current = extraLibs
        }

        const diags = await workerClient.getDiagnostics()

        // ONLY update if the code hasn't changed since we started the request.
        // This prevents "flickering" or misaligned squiggles from old versions of the file.
        if (lastCodeRef.current === code) {
          setDiagnostics(diags)
        }
      } catch (error) {
        console.error('Diagnostic pipeline error', error)
      }
    }, 250)

    return () => {
      if (timerRef.current) globalThis.clearTimeout(timerRef.current)
    }
  }, [code, isTypeScript, extraLibs])

  return diagnostics
}
