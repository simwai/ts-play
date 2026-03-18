import { type ReactNode } from 'react'
import { cn } from '../../utils/cn'

type PanelHeaderProps = {
  label: string
  isOpen: boolean
  onToggle: () => void
  left?: ReactNode
  right?: ReactNode
  className?: string
}

export function PanelHeader({
  label,
  isOpen,
  onToggle,
  left,
  right,
  className,
}: PanelHeaderProps) {
  return (
    <div
      role='button'
      aria-expanded={isOpen}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      className={cn(
        'flex items-center justify-between px-4 py-2 cursor-pointer select-none h-10 transition-colors duration-150 bg-mantle hover:bg-surface0 touch-none',
        className
      )}
    >
      <div className='flex items-center gap-3'>
        <span className='font-mono text-xs font-bold tracking-wider uppercase text-subtext0'>
          {label}
        </span>
        {left}
      </div>

      <div className='flex items-center gap-3'>
        {right && (
          <div
            onClick={(e) => {
              e.stopPropagation()
            }}
            className='flex items-center gap-2'
          >
            {right}
          </div>
        )}
        <span
          className={cn(
            'text-sm inline-block leading-none pointer-events-none transition-transform duration-200 text-overlay1',
            isOpen ? 'rotate-180' : 'rotate-0'
          )}
        >
          ▾
        </span>
      </div>
    </div>
  )
}
