import re

with open('src/lib/monaco-themes.ts', 'r') as f:
    content = f.read()

shiki_dark = """
export const shikiDark: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'd73a49' },
    { token: 'string', foreground: '032f62' },
    { token: 'number', foreground: '005cc5' },
    { token: 'type', foreground: '6f42c1' },
    { token: 'class', foreground: '6f42c1' },
    { token: 'function', foreground: '6f42c1' },
    { token: 'variable', foreground: '24292e' },
    { token: 'constant', foreground: '005cc5' },
    { token: 'operator', foreground: 'd73a49' },
  ],
  colors: {
    'editor.background': '#24292e',
    'editor.foreground': '#e1e4e8',
    'editor.lineHighlightBackground': '#2b3036',
    'editor.selectionBackground': '#3392FF44',
    'editorLineNumber.foreground': '#444d56',
    'editorLineNumber.activeForeground': '#e1e4e8',
  },
};
"""

shiki_light = """
export const shikiLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'd73a49' },
    { token: 'string', foreground: '032f62' },
    { token: 'number', foreground: '005cc5' },
    { token: 'type', foreground: '6f42c1' },
    { token: 'class', foreground: '6f42c1' },
    { token: 'function', foreground: '6f42c1' },
    { token: 'variable', foreground: '24292e' },
    { token: 'constant', foreground: '005cc5' },
    { token: 'operator', foreground: 'd73a49' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#24292e',
    'editor.lineHighlightBackground': '#f6f8fa',
    'editor.selectionBackground': '#0366d625',
    'editorLineNumber.foreground': '#1b1f234d',
    'editorLineNumber.activeForeground': '#24292e',
  },
};
"""

shades_of_purple = """
export const shadesOfPurple: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'b362ff', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff9d00' },
    { token: 'string', foreground: 'a5ff90' },
    { token: 'number', foreground: 'ff628c' },
    { token: 'type', foreground: '9effff' },
    { token: 'class', foreground: '9effff' },
    { token: 'function', foreground: 'fad000' },
    { token: 'variable', foreground: '9effff' },
    { token: 'constant', foreground: 'ff628c' },
    { token: 'operator', foreground: 'ff9d00' },
  ],
  colors: {
    'editor.background': '#2d2b55',
    'editor.foreground': '#a599e9',
    'editor.lineHighlightBackground': '#3b3969',
    'editor.selectionBackground': '#b362ff88',
    'editorLineNumber.foreground': '#a599e9',
    'editorLineNumber.activeForeground': '#fad000',
    'editorIndentGuide.background': '#a599e94d',
    'editorIndentGuide.activeBackground': '#a599e999',
  },
};
"""

with open('src/lib/monaco-themes.ts', 'a') as f:
    f.write(shikiDark)
    f.write(shikiLight)
    f.write(shadesOfPurple)

# Shiki Light colors were a bit messed up above (used dark colors for rules), let's fix it properly in the script if needed, but I'll rewrite the file with correct ones.
