import type { TSDiagnostic } from '../hooks/useTSDiagnostics'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/\'/g, '&#039;')
}

export function buildHtml(code: string): string {
  const keywords = [
    'export',
    'type',
    'const',
    'import',
    'from',
    'readonly',
    'as',
    'extends',
    'infer',
    'never',
    'keyof',
    'typeof',
    'interface',
    'class',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'new',
    'async',
    'await',
    'try',
    'catch',
    'throw',
    'implements',
    'private',
    'public',
    'protected',
    'static',
    'in',
  ]
  const types = [
    'Type',
    'Static',
    'String',
    'Number',
    'Boolean',
    'Object',
    'Array',
    'Any',
    'Unknown',
    'Never',
    'Void',
    'Null',
    'Undefined',
    'Symbol',
    'BigInt',
    'Record',
    'Partial',
    'Required',
    'Readonly',
    'Pick',
    'Omit',
    'Exclude',
    'Extract',
    'NonNullable',
    'ReturnType',
    'InstanceType',
    'ThisType',
    'Uppercase',
    'Lowercase',
    'Capitalize',
    'Uncapitalize',
  ]

  const keywordsPattern = keywords.join('|')
  const typesPattern = types.join('|')

  const tokenRegex = new RegExp(
    '(//.*|/\\*[\\s\\S]*?\\*/|\'.*?\'|".*?"|`[\\s\\S]*?`|\\b(?:' + keywordsPattern + ')\\b|\\b(?:' + typesPattern + ')\\b)',
    'g',
  )

  const parts = code.split(tokenRegex)
  let html = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === undefined) continue
    if (i % 2 === 0) {
      html += escapeHtml(part)
    } else {
      const escapedToken = escapeHtml(part)
      if (part.startsWith('//') || part.startsWith('/*')) {
        html += '<span class="text-overlay2 italic">' + escapedToken + '</span>'
      } else if (part.startsWith("\'") || part.startsWith('"') || part.startsWith('`')) {
        html += '<span class="text-green">' + escapedToken + '</span>'
      } else if (keywords.indexOf(part) !== -1) {
        html += '<span class="text-mauve">' + escapedToken + '</span>'
      } else if (types.indexOf(part) !== -1) {
        html += '<span class="text-blue">' + escapedToken + '</span>'
      } else {
        html += escapedToken
      }
    }
  }

  return html
}

export function buildSquiggles(code: string, diagnostics: TSDiagnostic[]): string {
  if (diagnostics.length === 0) return escapeHtml(code)

  const sortedDiagnostics = [...diagnostics].sort((a, b) => a.start - b.start)
  let htmlResult = ''
  let currentPosition = 0

  for (const diagnostic of sortedDiagnostics) {
    if (diagnostic.start < currentPosition) continue

    htmlResult += escapeHtml(code.slice(currentPosition, diagnostic.start))
    const diagnosticText = code.slice(diagnostic.start, diagnostic.start + diagnostic.length)

    const severityClass = diagnostic.category === 1 ? 'decoration-red' : 'decoration-yellow'
    htmlResult += '<span class="underline underline-wavy ' + severityClass + ' decoration-2">' + escapeHtml(diagnosticText) + '</span>'

    currentPosition = diagnostic.start + diagnostic.length
  }

  htmlResult += escapeHtml(code.slice(currentPosition))
  return htmlResult
}
