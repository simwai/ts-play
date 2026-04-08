import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'
export function Badge({ children, variant = 'default', className }: { children: ReactNode, variant?: 'error' | 'warn' | 'info' | 'default', className?: string }) {
  const variants = { error: 'bg-red/10 text-red', warn: 'bg-yellow/10 text-yellow', info: 'bg-blue/10 text-blue', default: 'bg-surface0 text-subtext1' }
  return <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border border-current/20', variants[variant], className)}>{children}</span>
}
