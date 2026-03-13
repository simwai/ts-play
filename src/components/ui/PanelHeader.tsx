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
        'flex items-center justify-between px-[12px] py-[6px] cursor-pointer select-none min-h-[32px] transition-colors duration-120 bg-mantle hover:bg-surface0',
        className
      )}
    >
      <div className='flex items-center gap-[7px]'>
        <span className='font-mono text-[11px] font-bold tracking-[0.06em] uppercase text-subtext0'>
          {label}
        </span>
        {left}
      </div>

      <div className='flex items-center gap-[8px]'>
        {right && (
          <div
            onClick={(e) => {
              e.stopPropagation()
            }}
            className='flex items-center gap-[6px]'
          >
            {right}
          </div>
        )}
        <span
          className={cn(
            'text-[12px] inline-block leading-none pointer-events-none transition-transform duration-200 text-overlay1',
            isOpen ? 'rotate-180' : 'rotate-0'
          )}
        >
          ▾
        </span>
      </div>
    </div>
  )
}
