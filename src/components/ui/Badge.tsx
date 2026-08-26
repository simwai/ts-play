import { type CSSProperties } from 'react'
import { cn } from '../../utils/cn'

type BadgeVariant = 'default' | 'error' | 'warn' | 'info'

type BadgeProps = {
  label: string
  variant?: BadgeVariant
  style?: CSSProperties
  className?: string
}

export function Badge({
  label,
  variant = 'default',
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
        },
        className
      )}
      style={style}
    >
      {label}
    </span>
  )
}
