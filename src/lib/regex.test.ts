import { describe, expect, it } from 'vitest'
import { RegexPatterns } from './regex'

describe('RegexPatterns', () => {
  it('LEADING_SLASH should match and strip leading slash', () => {
    const re = RegexPatterns.LEADING_SLASH
    expect('/foo/bar'.replace(re, '')).toBe('foo/bar')
    expect('foo/bar'.replace(re, '')).toBe('foo/bar')
  })

  it('CAPITAL_LETTERS should match capital letters for camelCase to space conversion', () => {
    const re = RegexPatterns.CAPITAL_LETTERS
    expect('camelCase'.replace(re, ' $1')).toBe('camel Case')
    expect('GitHubDark'.replace(re, ' $1')).toBe(' Git Hub Dark')
  })

  it('ANSI_ESCAPE should match ANSI escape sequences', () => {
    const re = RegexPatterns.ANSI_ESCAPE
    const text = '\u001b[32mHello\u001b[0m World'
    expect(text.replace(re, '')).toBe('Hello World')
  })

  it('MARKDOWN_LINKS_OR_CODE should match various markdown elements', () => {
    const re = RegexPatterns.MARKDOWN_LINKS_OR_CODE
    const text = 'Check [this](https://example.com) and `code` here. Also visit https://vitest.dev'
    const matches = text.match(re)
    expect(matches).toContain('[this](https://example.com)')
    expect(matches).toContain('`code`')
    expect(matches).toContain('https://vitest.dev')
  })

  it('MARKDOWN_LINK should capture name and url', () => {
    const re = RegexPatterns.MARKDOWN_LINK
    const match = re.exec('[Example](https://example.com)')
    expect(match).not.toBeNull()
    expect(match![1]).toBe('Example')
    expect(match![2]).toBe('https://example.com')
  })

  it('URL should match standalone URLs', () => {
    const re = RegexPatterns.URL
    expect(re.test('https://example.com')).toBe(true)
    expect(re.test('http://localhost:3000')).toBe(true)
    expect(re.test('not a url')).toBe(false)
  })

  it('IMPORT_EXPORT should match various import/require statements', () => {
    const re = RegexPatterns.IMPORT_EXPORT
    const code = `
      import { foo } from 'bar';
      import('baz');
      require('qux');
    `
    const matches = []
    let m
    while ((m = re.exec(code)) !== null) {
      // New regex has groups 1 (import/export) and 2 (require)
      matches.push(m[1] || m[2])
    }
    expect(matches).toContain('bar')
    expect(matches).toContain('baz')
    expect(matches).toContain('qux')
  })

  it('NEWLINE should match different newline characters', () => {
    const re = RegexPatterns.NEWLINE
    expect('line1\nline2'.split(re)).toEqual(['line1', 'line2'])
    expect('line1\r\nline2'.split(re)).toEqual(['line1', 'line2'])
    expect('line1\rline2'.split(re)).toEqual(['line1', 'line2'])
  })

  it('INCOMPLETE_ANSI should detect trailing incomplete ANSI sequences', () => {
    const re = RegexPatterns.INCOMPLETE_ANSI
    expect(re.test('\u001b[32')).toBe(true)
    expect(re.test('\u001b[')).toBe(true)
    expect(re.test('hello')).toBe(false)
  })

  it('EXCESSIVE_WHITESPACE should match 5 or more spaces', () => {
    const re = RegexPatterns.EXCESSIVE_WHITESPACE
    expect('too     many spaces'.replace(re, '    ')).toBe('too    many spaces')
    expect('four    spaces'.replace(re, '    ')).toBe('four    spaces')
  })

  it('EXCESSIVE_SPACES should match 10 or more spaces', () => {
    const re = RegexPatterns.EXCESSIVE_SPACES
    expect('way          too many'.replace(re, 'X')).toBe('wayXtoo many')
    expect('nine         '.replace(re, 'X')).toBe('nine         ')
  })

  it('BASE64_PADDING should match trailing equals', () => {
    const re = RegexPatterns.BASE64_PADDING
    expect('SGVsbG8=='.replace(re, '')).toBe('SGVsbG8')
    expect('SGVsbG8'.replace(re, '')).toBe('SGVsbG8')
  })
})
