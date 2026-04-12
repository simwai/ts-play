import { useEffect, useState } from 'react'
import { workerClient } from '../lib/workerClient'
import { type TSDiagnostic } from '../lib/types'

const EMPTY_LIBS = {}

export function useTSDiagnostics(
  code: string,
  isTypeScript: boolean,
  extraLibs: Record<string, string> = EMPTY_LIBS
) {
  const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([])

  useEffect(() => {
    if (!isTypeScript) {
      setDiagnostics([])
      return
    }

    const timer = setTimeout(async () => {
      // First ensure the worker has the latest code
      await workerClient.updateFile(code)

      const result = await workerClient.getDiagnostics()
      result.match(
        (results) => setDiagnostics(results),
        (error) => console.error('Diagnostics error:', error)
      )
    }, 500)

    return () => clearTimeout(timer)
  }, [code, isTypeScript, extraLibs])

  return diagnostics
}
