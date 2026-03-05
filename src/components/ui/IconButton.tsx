import { CSSProperties, ReactNode, useState } from 'react';
import { CatppuccinTheme } from '../../lib/theme';

interface IconButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  disabled?: boolean;
  theme: CatppuccinTheme;
  children: ReactNode;
  variant?: 'ghost' | 'surface' | 'danger';
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

export function IconButton({
  onClick,
  title,
  disabled = false,
  theme: t,
  children,
  variant = 'surface',
  size = 'md',
  style,
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const pad = size === 'sm' ? '3px 6px' : '5px 9px';

  const bg =
    variant === 'ghost'
      ? hovered ? t.surface0 : 'transparent'
      : variant === 'danger'
      ? hovered ? `${t.red}28` : `${t.red}15`
      : hovered ? t.surface1 : t.surface0;

  const border =
    variant === 'ghost'  ? 'none' :
    variant === 'danger' ? `1px solid ${t.red}${hovered ? '60' : '44'}` :
    `1px solid ${t.surface1}`;

  const col =
    variant === 'danger' ? t.red :
    disabled             ? t.overlay0 :
    t.text;

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background:     bg,
        border,
        borderRadius:   5,
        padding:        pad,
        fontSize:       13,
        lineHeight:     1,
        color:          col,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        transition:     'background 120ms, border-color 120ms, transform 80ms',
        transform:      pressed && !disabled ? 'scale(0.93)' : 'none',
        opacity:        disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
