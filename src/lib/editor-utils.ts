import type { TSDiagnostic } from './types'
import { tokenize, type TokenType } from './tokenizer'

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/\'/g, '&#039;')
}

const tokenTypeToClass: Record<TokenType, string> = {
  keyword: 'text-mauve',
  string: 'text-green',
  number: 'text-peach',
  comment: 'text-overlay2 italic',
  function: 'text-blue',
  type: 'text-yellow',
  operator: 'text-sky',
  punctuation: 'text-overlay2',
  decorator: 'text-pink',
  variable: 'text-text',
  constant: 'text-peach',
  boolean: 'text-peach',
  property: 'text-sapphire',
  parameter: 'text-maroon',
  plain: '',
}

export function buildHtml(code: string): string {
  const tokens = tokenize(code)
  let html = ''

  for (const token of tokens) {
    const className = tokenTypeToClass[token.type]
    const escapedValue = escapeHtml(token.value)
    if (className) {
      // Use <i> for italics to allow CSS override
      const tag = className.includes('italic') ? 'i' : 'span'
      html += `<${tag} class="${className}">${escapedValue}</${tag}>`
    } else {
      html += escapedValue
    }
  }

  return html
}

function buildSquiggles(
  code: string,
  diagnostics: TSDiagnostic[]
): string {
  if (diagnostics.length === 0) return escapeHtml(code)

  const sortedDiagnostics = [...diagnostics].sort((a, b) => a.start - b.start)
  let htmlResult = ''
  let currentPosition = 0

  for (const diagnostic of sortedDiagnostics) {
    if (diagnostic.start < currentPosition) continue

    htmlResult += escapeHtml(code.slice(currentPosition, diagnostic.start))
    const diagnosticText = code.slice(
      diagnostic.start,
      diagnostic.start + diagnostic.length
    )

    const severityClass =
      diagnostic.category === 'error' ? 'decoration-red' : 'decoration-yellow'
    htmlResult +=
      '<span class="underline underline-wavy ' +
      severityClass +
      ' decoration-2">' +
      escapeHtml(diagnosticText) +
      '</span>'

    currentPosition = diagnostic.start + diagnostic.length
  }

  htmlResult += escapeHtml(code.slice(currentPosition))
  return htmlResult
}
