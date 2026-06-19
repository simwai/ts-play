export const RegexPatterns = {
  IMPORT: /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]/g,
  REQUIRE: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  PACKAGE_NAME: /^(@[\w-]+\/[\w-]+|[\w-]+)/,
  LEADING_SLASH: /^\/+/,
  CAPITAL_LETTERS: /([A-Z])/g,
  ANSI_ESCAPE: /\u001b\[[0-9;]*m/g,
  MARKDOWN_LINKS_OR_CODE:
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(`[^`]+`)|(https?:\/\/[^\s)]+)/g,
  MARKDOWN_LINK: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
  URL: /https?:\/\/[^\s)]+/,
  IMPORT_EXPORT:
    /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)|require\(['"]([^'"]+)['"]\)/g,
  NEWLINE: /\r?\n|\r/g,
  INCOMPLETE_ANSI: /\u001b\[[0-9;]*$/,
  EXCESSIVE_WHITESPACE: / {5,}/g,
  EXCESSIVE_SPACES: / {10,}/g,
  BASE64_PADDING: /=+$/,
} as const

export function toRegExp(pattern: RegExp | string): RegExp {
  if (pattern instanceof RegExp) {
    return new RegExp(pattern.source, pattern.flags)
  }
  return new RegExp(pattern)
}
