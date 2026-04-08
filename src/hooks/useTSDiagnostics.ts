import { useEffect, useState, useRef } from 'react'
import { workerClient } from '../lib/workerClient'

export interface TSDiagnostic {
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
  const lastLibsRef = useRef<Record<string, string>>(EMPTY_LIBS)
  const lastCodeRef = useRef<string>('')

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([])
      return
    }

    if (code === lastCodeRef.current && extraLibs === lastLibsRef.current) {
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(async () => {
      try {
        const results = await workerClient.getDiagnostics()
        setDiagnostics(results as TSDiagnostic[])
        lastCodeRef.current = code
        lastLibsRef.current = extraLibs
      } catch (e) {
        console.error('Failed to get diagnostics', e)
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code, isTypeScript, extraLibs])

  return diagnostics
}
