import { describe, it, expect } from 'vitest';
import Ansi from 'ansi-to-html';

const ANSI_COLORS = {
  0: '#000000',
  1: '#CD0000',
  2: '#00CD00',
  3: '#CDCD00',
  4: '#0000EE',
  5: '#CD00CD',
  6: '#00CDCD',
  7: '#E5E5E5',
  8: '#7F7F7F',
  9: '#FF0000',
  10: '#00FF00',
  11: '#FFFF00',
  12: '#5C5CFF',
  13: '#FF00FF',
  14: '#00FFFF',
  15: '#FFFFFF',
};

describe('ANSI to HTML Conversion', () => {
  const converter = new Ansi({
    newline: false,
    escapeHtml: true,
    stream: false,
    colors: ANSI_COLORS,
  });

  it('converts basic 16 colors', () => {
    const input = '\x1b[31mRed Text\x1b[0m';
    const output = converter.toHtml(input);
    expect(output).toContain('color:#CD0000');
    expect(output).toContain('Red Text');
  });

  it('handles TrueColor (24-bit) RGB sequences', () => {
    const input = '\x1b[38;2;255;100;50mCustom RGB\x1b[0m';
    const output = converter.toHtml(input);
    // It seems it converts to hex #ff6432
    expect(output).toContain('color:#ff6432');
    expect(output).toContain('Custom RGB');
  });

  it('handles bold/italic with semantic tags', () => {
    const input = '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m';
    const output = converter.toHtml(input);
    expect(output).toContain('<b>Bold</b>');
    expect(output).toContain('<i>Italic</i>');
  });
});
