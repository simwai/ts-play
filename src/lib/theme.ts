export type ThemeName =
  | 'mocha'
  | 'latte'
  | 'monokai'
  | 'shades-of-purple'
  | 'github-dark'
  | 'github-light'

export const DARK_THEMES: ThemeName[] = [
  'mocha',
  'monokai',
  'shades-of-purple',
  'github-dark',
]

export const LIGHT_THEMES: ThemeName[] = [
  'latte',
  'github-light',
]

export type ThemeMode = 'dark' | 'light'

export const THEME_LABELS: Record<ThemeName, string> = {
  'mocha': 'Mocha (Catppuccin)',
  'latte': 'Latte (Catppuccin)',
  'monokai': 'Monokai',
  'shades-of-purple': 'Shades of Purple',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
}
