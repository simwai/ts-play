import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'error' | 'warn' | 'info' | 'default' | 'success'

export interface BadgeProps {
  children?: ReactNode
  variant?: BadgeVariant
  className?: string
  label?: string
}

export function Badge({
  children,
  label,
  variant = 'default',
  className,
}: BadgeProps) {
  const variants = {
    error: 'bg-red/10 text-red border-red/20',
    warn: 'bg-yellow/10 text-yellow border-yellow/20',
    info: 'bg-blue/10 text-blue border-blue/20',
    success: 'bg-green/10 text-green border-green/20',
    default: 'bg-surface0 text-subtext1 border-surface1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors whitespace-nowrap uppercase tracking-wider',
        variants[variant],
        className
      )}
    >
      {children || label}
    </span>
  )
}
