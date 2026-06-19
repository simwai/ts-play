import type { TSDiagnostic } from './types'

export function getDiagnosticAtPosition(
  diagnostics: TSDiagnostic[],
  line: number,
  col: number
): TSDiagnostic | null {
  return (
    diagnostics.find(
      (d) =>
        d.line === line && col >= d.character && col <= d.character + d.length
    ) || null
  )
}
