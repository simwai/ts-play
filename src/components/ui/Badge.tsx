import { type CSSProperties } from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'error'
  | 'warn'
  | 'info'
  | 'success'
  | 'custom';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  color?: string; // Used when variant === 'custom'
  style?: CSSProperties;
  className?: string;
};

export function Badge({
  label,
  variant = 'default',
  color,
  style,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'text-4xs font-bold tracking-wider uppercase font-mono rounded-[0.1875rem] px-1.5 py-0.5 shrink-0 leading-none border',
        {
          'bg-overlay1/20 text-overlay1 border-overlay1/40':
            variant === 'default',
          'bg-red/20 text-red border-red/40': variant === 'error',
          'bg-yellow/20 text-yellow border-yellow/40': variant === 'warn',
          'bg-blue/20 text-blue border-blue/40': variant === 'info',
          'bg-green/20 text-green border-green/40': variant === 'success',
        },
        className,
      )}
      style={
        variant === 'custom' && color
          ? {
              color,
              background: `${color}20`,
              borderColor: `${color}40`,
              ...style,
            }
          : style
      }
    >
      {label}
    </span>
  );
}
