export const DARK_THEMES = [
  'vs-dark',
  'hc-black',
  'oceanic-next',
  'monokai',
  'dracula',
  'nord',
  'night-owl',
  'ayu-dark',
  'tomorrow-night',
  'cobalt',
  'shades-of-purple',
]

export const LIGHT_THEMES = [
  'vs',
  'hc-light',
  'light-plus',
  'solarized-light',
  'github-light',
  'quietlight',
  'tomorrow',
]

export type ThemeMode = 'dark' | 'light'
export const THEME_LABELS: Record<string, string> = {
  'vs-dark': 'VS Dark',
  'github-dark': 'GitHub Dark',
}
