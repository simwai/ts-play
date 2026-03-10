import { CSSProperties } from 'react';
import { CatppuccinTheme } from '../../lib/theme';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'error' | 'warn' | 'info' | 'success' | 'custom';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string; // used when variant === 'custom'
  theme: CatppuccinTheme;
  style?: CSSProperties;
  className?: string;
}

export function Badge({ label, variant = 'default', color, theme: t, style, className }: BadgeProps) {
  const c = resolveColor(variant, color, t);
  return (
    <span 
      className={cn(
        "text-[9px] font-bold tracking-[0.08em] uppercase font-mono rounded-[3px] px-[5px] py-[1px] shrink-0 leading-[14px]",
        className
      )}
      style={{
        color: c,
        background: `${c}20`,
        border: `1px solid ${c}40`,
        ...style,
      }}
    >
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
