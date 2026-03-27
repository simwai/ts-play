export type ThemeMode =
  | 'mocha'
  | 'latte'
  | 'githubDark'
  | 'githubLight'
  | 'monokai'
  | 'shadesOfPurple';

export const DARK_THEMES: ThemeMode[] = [
  'mocha',
  'githubDark',
  'monokai',
  'shadesOfPurple',
];
export const LIGHT_THEMES: ThemeMode[] = ['latte', 'githubLight'];

export const THEME_LABELS: Record<ThemeMode, string> = {
  mocha: 'Catppuccin Mocha',
  latte: 'Catppuccin Latte',
  githubDark: 'GitHub Dark',
  githubLight: 'GitHub Light',
  monokai: 'Monokai',
  shadesOfPurple: 'Shades of Purple',
};

export function isDarkMode(theme: ThemeMode): boolean {
  return DARK_THEMES.includes(theme);
}
