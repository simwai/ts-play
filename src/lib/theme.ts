export type ThemeMode = 'latte' | 'mocha'

const getSyntaxColors = () => ({
  keyword: 'var(--mauve)',
  string: 'var(--green)',
  number: 'var(--peach)',
  comment: 'var(--overlay1)',
  function: 'var(--blue)',
  type: 'var(--yellow)',
  operator: 'var(--sky)',
  punctuation: 'var(--overlay2)',
  decorator: 'var(--pink)',
  variable: 'var(--text)',
  constant: 'var(--peach)',
  boolean: 'var(--peach)',
  property: 'var(--sapphire)',
  parameter: 'var(--maroon)',
})
