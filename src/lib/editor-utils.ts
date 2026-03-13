import { getSyntaxColors } from './theme'
import { tokenize } from './tokenizer'
import type { TSDiagnostic } from '../hooks/useTSDiagnostics'

export function escHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function buildHtml(code: string): string {
  const sc = getSyntaxColors()
  const COLOR: Record<string, string> = {
    keyword: sc.keyword,
    string: sc.string,
    number: sc.number,
    comment: sc.comment,
    function: sc.function,
    type: sc.type,
    operator: sc.operator,
    punctuation: sc.punctuation,
    decorator: sc.decorator,
    variable: sc.variable,
    constant: sc.constant,
    boolean: sc.boolean,
    property: sc.property,
    parameter: sc.parameter,
    plain: 'var(--text)',
  }
  return tokenize(code)
    .map((tok) => {
      const color = COLOR[tok.type] ?? 'var(--text)'
      const safe = escHtml(tok.value)
      return `<span style="color:${color}">${safe}</span>`
    })
    .join('')
}

export function buildSquiggles(
  code: string,
  diagnostics: TSDiagnostic[]
): string {
  if (diagnostics.length === 0) return escHtml(code)
  const sorted = [...diagnostics].sort((a, b) => a.start - b.start)
  const parts: string[] = []
  let cursor = 0
  for (const d of sorted) {
    const { start } = d
    const end = Math.min(d.start + d.length, code.length)
    if (start < cursor) continue
    if (start > cursor) parts.push(escHtml(code.slice(cursor, start)))
    const color = d.category === 'error' ? 'var(--red)' : 'var(--yellow)'
    parts.push(
      `<span style="text-decoration:underline wavy ${color};text-decoration-thickness:1.5px;text-underline-offset:3px;">${escHtml(code.slice(start, end))}</span>`
    )
    cursor = end
  }

  if (cursor < code.length) parts.push(escHtml(code.slice(cursor)))
  return parts.join('')
}
