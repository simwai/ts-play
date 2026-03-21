export type ThemeMode =
  | 'mocha'
  | 'latte'
  | 'githubDark'
  | 'githubLight'
  | 'monokai';

export const DARK_THEMES: ThemeMode[] = ['mocha', 'githubDark', 'monokai'];
export const LIGHT_THEMES: ThemeMode[] = ['latte', 'githubLight'];

export function isDarkMode(theme: ThemeMode): boolean {
  return DARK_THEMES.includes(theme);
}
