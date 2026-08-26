export const RegexPatterns = {
  LEADING_SLASH: '/^\\//',
  CAPITAL_LETTERS: '/([A-Z])/g',
  ANSI_ESCAPE: '/[\\u001b\\u009b][\\[\\]()#;?]*[0-9;]*[a-zA-Z]/g',
  MARKDOWN_LINKS_OR_CODE:
    '/(\\[[^\\]]+]\\(https?:\\/\\/[^\\s)]+\\)|https?:\\/\\/[^\\s)]+|`[^`]+`)/g',
  MARKDOWN_LINK: '/^\\[([^\\]]+)]\\((https?:\\/\\/[^\\s)]+)\\)$/',
  URL: '/^(https?:\\/\\/[^\\s)]+)$/',
  IMPORT_EXPORT:
    '/(?:import\\s+(?:[\\w\\s{},*]+)\\s+from\\s+[\'"]([^\'"]+)[\'"])|(import\\([\'"]([^\'"]+)[\'"]\\))|(require\\([\'"]([^\'"]+)[\'"]\\))/g',
  NEWLINE: '/\\r?\\n|\\r/',
  INCOMPLETE_ANSI: '/[\\u001b\\u009b][\\[\\]()#;?]*[0-9;]*$/',
  EXCESSIVE_WHITESPACE: '/\\s{5,}/g',
  EXCESSIVE_SPACES: '/ {10,}/g',
  BASE64_PADDING: '/=+$/g',
} as const

export type RegexPatterns = (typeof RegexPatterns)[keyof typeof RegexPatterns]

const compiledCache = new Map<string, RegExp>()

export function toRegExp(pattern: string): RegExp {
  const match = pattern.match(/^\/(.*)\/(.*)$/)
  if (!match) throw new Error(`Invalid regex pattern: ${pattern}`)
  const [, p, flags] = match
  // Global/sticky regexes carry lastIndex state; sharing instances would
  // corrupt .test()/.exec() across call sites, so only stateless ones cache.
  if (/[gy]/.test(flags)) return new RegExp(p, flags)
  const cached = compiledCache.get(pattern)
  if (cached) return cached
  const compiled = new RegExp(p, flags)
  compiledCache.set(pattern, compiled)
  return compiled
}
