import { CSSProperties } from 'react';
import { CatppuccinTheme } from '../../lib/theme';

export type BadgeVariant = 'default' | 'error' | 'warn' | 'info' | 'success' | 'custom';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string; // used when variant === 'custom'
  theme: CatppuccinTheme;
  style?: CSSProperties;
}

export function Badge({ label, variant = 'default', color, theme: t, style }: BadgeProps) {
  const c = resolveColor(variant, color, t);
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: 'monospace',
      color: c,
      background: `${c}20`,
      border: `1px solid ${c}40`,
      borderRadius: 3,
      padding: '1px 5px',
      flexShrink: 0,
      lineHeight: '14px',
      ...style,
    }}>
      {label}
    </span>
  );
}

function resolveColor(variant: BadgeVariant, custom: string | undefined, t: CatppuccinTheme): string {
  switch (variant) {
    case 'error':   return t.red;
    case 'warn':    return t.yellow;
    case 'info':    return t.blue;
    case 'success': return t.green;
    case 'custom':  return custom ?? t.overlay1;
    default:        return t.overlay1;
  }
}
