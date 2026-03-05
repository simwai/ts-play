export type ThemeMode = 'latte' | 'mocha';

export interface CatppuccinTheme {
  name: string;
  mode: ThemeMode;
  // Base surfaces
  base: string;
  mantle: string;
  crust: string;
  // Surface overlays
  surface0: string;
  surface1: string;
  surface2: string;
  // Overlays
  overlay0: string;
  overlay1: string;
  overlay2: string;
  // Text
  text: string;
  subtext0: string;
  subtext1: string;
  // Accents
  rosewater: string;
  flamingo: string;
  pink: string;
  mauve: string;
  red: string;
  maroon: string;
  peach: string;
  yellow: string;
  green: string;
  teal: string;
  sky: string;
  sapphire: string;
  blue: string;
  lavender: string;
}

export const latte: CatppuccinTheme = {
  name: 'Catppuccin Latte',
  mode: 'latte',
  base: '#eff1f5',
  mantle: '#e6e9ef',
  crust: '#dce0e8',
  surface0: '#ccd0da',
  surface1: '#bcc0cc',
  surface2: '#acb0be',
  overlay0: '#9ca0b0',
  overlay1: '#8c8fa1',
  overlay2: '#7c7f93',
  text: '#4c4f69',
  subtext0: '#6c6f85',
  subtext1: '#5c5f77',
  rosewater: '#dc8a78',
  flamingo: '#dd7878',
  pink: '#ea76cb',
  mauve: '#8839ef',
  red: '#d20f39',
  maroon: '#e64553',
  peach: '#fe640b',
  yellow: '#df8e1d',
  green: '#40a02b',
  teal: '#179299',
  sky: '#04a5e5',
  sapphire: '#209fb5',
  blue: '#1e66f5',
  lavender: '#7287fd',
};

export const mocha: CatppuccinTheme = {
  name: 'Catppuccin Mocha',
  mode: 'mocha',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  overlay1: '#7f849c',
  overlay2: '#9399b2',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
};

export const getTheme = (mode: ThemeMode): CatppuccinTheme =>
  mode === 'latte' ? latte : mocha;

// Syntax token colors per theme
export const getSyntaxColors = (t: CatppuccinTheme) => ({
  keyword:   t.mauve,
  string:    t.green,
  number:    t.peach,
  comment:   t.overlay1,
  function:  t.blue,
  type:      t.yellow,
  operator:  t.sky,
  punctuation: t.overlay2,
  decorator: t.pink,
  variable:  t.text,
  constant:  t.peach,
  boolean:   t.peach,
  property:  t.sapphire,
  parameter: t.maroon,
});
