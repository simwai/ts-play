export type ThemeMode =
  | 'mocha'
  | 'latte'
  | 'monokai'
  | 'shades-of-purple'
  | 'github-dark'
  | 'github-light'

export const THEME_LABELS: Record<ThemeMode, string> = {
  mocha: 'Catppuccin Mocha',
  latte: 'Catppuccin Latte',
  monokai: 'Monokai',
  'shades-of-purple': 'Shades of Purple',
  'github-dark': 'GitHub Dark',
  'github-light': 'GitHub Light',
}

export const DARK_THEMES: ThemeMode[] = [
  'mocha',
  'monokai',
  'shades-of-purple',
  'github-dark',
]

export const LIGHT_THEMES: ThemeMode[] = ['latte', 'github-light']
