import type { editor } from 'monaco-editor'

// Standard Catppuccin Mocha rules
export const mocha: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
    { token: 'string', foreground: 'a6e3a1' },
    { token: 'number', foreground: 'fab387' },
    { token: 'keyword', foreground: 'cba6f7' },
    { token: 'type', foreground: 'f9e2af' },
    { token: 'function', foreground: '89b4fa' },
    { token: 'variable', foreground: 'cdd6f4' },
    { token: 'identifier', foreground: 'cdd6f4' },
    { token: 'delimiter', foreground: '94e2d5' },
    { token: 'constant', foreground: 'fab387' },
    { token: 'class', foreground: 'f9e2af' },
  ],
  colors: {
    'editor.background': '#1e1e2e',
    'editor.foreground': '#cdd6f4',
    'editorCursor.foreground': '#f5e0dc',
    'editor.lineHighlightBackground': '#313244',
    'editorLineNumber.foreground': '#45475a',
    'editorLineNumber.activeForeground': '#cdd6f4',
    'editor.selectionBackground': '#585b70',
    'editorIndentGuide.background': '#313244',
    'editorIndentGuide.activeBackground': '#45475a',
  },
}

// Standard Catppuccin Latte rules
export const latte: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9ca0b0', fontStyle: 'italic' },
    { token: 'string', foreground: '40a02b' },
    { token: 'number', foreground: 'fe640b' },
    { token: 'keyword', foreground: '8839ef' },
    { token: 'type', foreground: 'df8e1d' },
    { token: 'function', foreground: '1e66f5' },
    { token: 'variable', foreground: '4c4f69' },
    { token: 'identifier', foreground: '4c4f69' },
    { token: 'delimiter', foreground: '179287' },
    { token: 'constant', foreground: 'fe640b' },
    { token: 'class', foreground: 'df8e1d' },
  ],
  colors: {
    'editor.background': '#eff1f5',
    'editor.foreground': '#4c4f69',
    'editorCursor.foreground': '#dc8a78',
    'editor.lineHighlightBackground': '#ccd0da',
    'editorLineNumber.foreground': '#9ca0b0',
    'editorLineNumber.activeForeground': '#4c4f69',
    'editor.selectionBackground': '#acb0be',
    'editorIndentGuide.background': '#ccd0da',
    'editorIndentGuide.activeBackground': '#bcc0cc',
  },
}

export const monokai: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'F92672' },
    { token: 'type', foreground: '66D9EF' },
    { token: 'function', foreground: 'A6E22E' },
    { token: 'string', foreground: 'E6DB74' },
    { token: 'comment', foreground: '75715E' },
    { token: 'number', foreground: 'AE81FF' },
  ],
  colors: {
    'editor.background': '#272822',
    'editor.foreground': '#F8F8F2',
  },
}

export const shadesOfPurple: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'ff9d00' },
    { token: 'type', foreground: 'ff9d00' },
    { token: 'function', foreground: 'fad000' },
    { token: 'string', foreground: '3ad900' },
    { token: 'comment', foreground: 'b362ff' },
    { token: 'number', foreground: 'ff628c' },
  ],
  colors: {
    'editor.background': '#2d2b55',
    'editor.foreground': '#ffffff',
  },
}

export const githubDark: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'ff7b72' },
    { token: 'type', foreground: 'ffa657' },
    { token: 'function', foreground: 'd2a8ff' },
    { token: 'string', foreground: 'a5d6ff' },
    { token: 'comment', foreground: '8b949e' },
    { token: 'variable', foreground: 'c9d1d9' },
  ],
  colors: {
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
  },
}

export const githubLight: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'd73a49' },
    { token: 'type', foreground: 'e36209' },
    { token: 'function', foreground: '6f42c1' },
    { token: 'string', foreground: '032f62' },
    { token: 'comment', foreground: '6a737d' },
    { token: 'variable', foreground: '24292e' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#24292e',
  },
}
