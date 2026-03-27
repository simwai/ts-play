export type ThemeMode =
  | 'mocha'
  | 'latte'
  | 'githubDark'
  | 'githubLight'
  | 'monokai'
  | 'shikiDark'
  | 'shikiLight'
  | 'shadesOfPurple';

export const DARK_THEMES: ThemeMode[] = [
  'mocha',
  'githubDark',
  'monokai',
  'shikiDark',
  'shadesOfPurple',
];
export const LIGHT_THEMES: ThemeMode[] = ['latte', 'githubLight', 'shikiLight'];

export const THEME_LABELS: Record<ThemeMode, string> = {
  mocha: 'Catppuccin Mocha',
  latte: 'Catppuccin Latte',
  githubDark: 'GitHub Dark',
  githubLight: 'GitHub Light',
  monokai: 'Monokai',
  shikiDark: 'Shiki Dark',
  shikiLight: 'Shiki Light',
  shadesOfPurple: 'Shades of Purple',
};

export function isDarkMode(theme: ThemeMode): boolean {
  return DARK_THEMES.includes(theme);
}
