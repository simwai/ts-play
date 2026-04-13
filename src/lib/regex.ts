export enum RegexPatterns {
  LEADING_SLASH = '/^\\//',
  CAPITAL_LETTERS = '/([A-Z])/g',
  ANSI_ESCAPE = '/[\\u001b\\u009b][\\[\\]()#;?]*[0-9;]*[a-zA-Z]/g',
  MARKDOWN_LINKS_OR_CODE = '/(\\[[^\\]]+]\\(https?:\\/\\/[^\\s)]+\\)|https?:\\/\\/[^\\s)]+|`[^`]+`)/g',
  MARKDOWN_LINK = '/^\\[([^\\]]+)]\\((https?:\\/\\/[^\\s)]+)\\)$/',
  URL = '/^(https?:\\/\\/[^\\s)]+)$/',
  IMPORT_EXPORT = '/(?:import\\s+(?:[\\w\\s{},*]+)\\s+from\\s+[\'"]([^\'"]+)[\'"])|(import\\([\'"]([^\'"]+)[\'"]\\))|(require\\([\'"]([^\'"]+)[\'"]\\))/g',
  NEWLINE = '/\\r?\\n|\\r/',
  INCOMPLETE_ANSI = '/[\\u001b\\u009b][\\[\\]()#;?]*[0-9;]*$/',
  EXCESSIVE_WHITESPACE = '/\\s{5,}/g',
  EXCESSIVE_SPACES = '/ {10,}/g',
  BASE64_PADDING = '/=+$/g',
}

export function toRegExp(pattern: RegexPatterns): RegExp {
  const match = pattern.match(/^\/(.*)\/(.*)$/)
  if (!match) throw new Error(`Invalid regex pattern: ${pattern}`)
  const [, p, flags] = match
  return new RegExp(p, flags)
}
