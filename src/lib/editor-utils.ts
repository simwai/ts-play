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

  const tokenRegex = new RegExp(
    \`(//.*|/\\*[\\s\\S]*?\\*/|'.*?'|".*?"|\`[\\s\\S]*?\`|\\b(?:\${keywords.join('|')})\\b|\\b(?:\${types.join('|')})\\b)\`,
    'g',
  )

  const tokens = code.split(tokenRegex)

  return tokens
    .map((token, index) => {
      if (index % 2 === 0) {
        return escapeHtml(token)
      }

      const escapedToken = escapeHtml(token)
      if (token.startsWith('//') || token.startsWith('/*')) {
        return \`<span class="text-overlay2 italic">\${escapedToken}</span>\`
      }
      if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
        return \`<span class="text-green">\${escapedToken}</span>\`
      }
      if (keywords.includes(token)) {
        return \`<span class="text-mauve">\${escapedToken}</span>\`
      }
      if (types.includes(token)) {
        return \`<span class="text-blue">\${escapedToken}</span>\`
      }
      return escapedToken
    })
    .join('')
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
    htmlResult += \`<span class="underline underline-wavy \${severityClass} decoration-2">\${escapeHtml(
      diagnosticText,
    )}</span>\`

    currentPosition = diagnostic.start + diagnostic.length
  }

  htmlResult += escapeHtml(code.slice(currentPosition))
  return htmlResult
}
