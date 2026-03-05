import { CSSProperties, ReactNode, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: Variant;
  theme: CatppuccinTheme;
  title?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  onClick,
  disabled = false,
  children,
  variant = 'secondary',
  theme: t,
  title,
  style,
  type = 'button',
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const { bg, color, border } = resolveVariant(variant, disabled, hovered, pressed, t);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        padding:      '7px 14px',
        fontSize:     13,
        fontWeight:   variant === 'primary' ? 700 : 500,
        fontFamily:   'inherit',
        background:   bg,
        color,
        border,
        borderRadius: 5,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        transition:   'background 120ms, opacity 120ms, transform 80ms',
        whiteSpace:   'nowrap',
        transform:    pressed && !disabled ? 'scale(0.97)' : 'none',
        opacity:      disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function resolveVariant(
  variant: Variant,
  disabled: boolean,
  hovered: boolean,
  pressed: boolean,
  t: CatppuccinTheme,
): { bg: string; color: string; border: string } {
  if (disabled) return { bg: t.surface0, color: t.overlay0, border: `1px solid ${t.surface1}` };

  const dim = pressed ? 'dd' : hovered ? 'ee' : 'ff';

  switch (variant) {
    case 'primary':
      return {
        bg:     hovered ? t.teal  : t.green,
        color:  t.crust,
        border: 'none',
      };
    case 'danger':
      return {
        bg:     hovered ? `${t.red}28` : `${t.red}18`,
        color:  t.red,
        border: `1px solid ${t.red}${hovered ? '60' : '40'}`,
      };
    case 'ghost':
      return {
        bg:     hovered ? `${t.surface0}` : 'transparent',
        color:  t.text,
        border: 'none',
      };
    default: // secondary
      return {
        bg:     hovered ? t.surface1 : t.surface0,
        color:  t.text,
        border: `1px solid ${t.surface1}${dim}`,
      };
  }
}
