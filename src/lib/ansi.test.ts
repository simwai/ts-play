import { describe, it, expect } from 'vitest';

function stripAnsi(text: string): string {
  const ansiRegex = /[\u001b\u009b][\[\]()#;?]*[0-9;]*[a-zA-Z]/g;
  return text.replace(ansiRegex, '');
}

describe('ANSI Stripping Logic', () => {
  it('strips basic 16 color sequences', () => {
    const input = '\x1b[31mRed Text\x1b[0m';
    expect(stripAnsi(input)).toBe('Red Text');
  });

  it('strips TrueColor (24-bit) RGB sequences', () => {
    const input = '\x1b[38;2;255;100;50mCustom RGB\x1b[0m';
    expect(stripAnsi(input)).toBe('Custom RGB');
  });

  it('strips bold and italic sequences', () => {
    const input = '\x1b[1mBold\x1b[0m \x1b[3mItalic\x1b[0m';
    expect(stripAnsi(input)).toBe('Bold Italic');
  });

  it('handles complex mixed sequences', () => {
    const input = '\x1b[1;31mBold Red\x1b[0m and \x1b[4;32mUnderline Green\x1b[0m';
    expect(stripAnsi(input)).toBe('Bold Red and Underline Green');
  });
});
