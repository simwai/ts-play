export type ThemeMode = 'mocha' | 'latte' | 'monokai' | 'shades-of-purple' | 'github-dark' | 'github-light';

export const THEME_LABELS: Record<ThemeMode, string> = {
  mocha: 'Catppuccin Mocha',
  latte: 'Catppuccin Latte',
  monokai: 'Monokai',
  'shades-of-purple': 'Shades of Purple',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
};

export const DARK_THEMES: ThemeMode[] = ['mocha', 'monokai', 'shades-of-purple', 'github-dark'];
export const LIGHT_THEMES: ThemeMode[] = ['latte', 'github-light'];

export function isDarkMode(theme: ThemeMode): boolean {
  return DARK_THEMES.includes(theme);
}

export const getSyntaxColors = () => ({
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
