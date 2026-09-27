import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { useLongPressTooltip } from '../../hooks/useLongPressTooltip'
import { Tooltip } from './Tooltip'
import { sizeClasses } from '../../lib/sizeClasses'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'xs' | 'sm' | 'md' | 'lg'

type ButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  children: ReactNode
  variant?: Variant
  size?: Size
  title?: string
  tooltipAlign?: 'center' | 'right' | 'left'
  style?: CSSProperties
  type?: 'button' | 'submit' | 'reset'
  className?: string
  'data-testid'?: string
}

export function Button({
  onClick,
  disabled = false,
  children,
  variant = 'secondary',
  size = 'md',
  title,
  tooltipAlign = 'center',
  style,
  type = 'button',
  className,
  'data-testid': testId,
}: ButtonProps) {
  const { pressed, showTooltip, pressHandlers, touchHandlers, handleClick } =
    useLongPressTooltip(onClick)

  return (
    <button
      data-testid={testId}
      type={type}
      onClick={handleClick}
      disabled={disabled}
      aria-label={title}
      {...pressHandlers}
      {...touchHandlers}
      className={cn(
        'group relative font-inherit rounded-md flex items-center justify-center gap-1.5 transition-all duration-150 whitespace-nowrap',
        sizeClasses[size],
        variant === 'primary' ? 'font-bold' : 'font-medium',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer opacity-100',
        pressed && !disabled ? 'scale-95' : 'scale-100',
        {
          'bg-green text-[color:var(--crust)] hover:bg-teal border-none':
            variant === 'primary',
          'bg-surface0 text-text hover:bg-surface1 border border-surface1':
            variant === 'secondary',
          'bg-red/15 text-red hover:bg-red/25 border border-red/40 hover:border-red/60':
            variant === 'danger',
          'bg-transparent text-text hover:bg-surface0 border-none':
            variant === 'ghost',
        },
        className
      )}
      style={style}
    >
      {children}
      {title && (
        <Tooltip
          title={title}
          align={tooltipAlign}
          show={showTooltip}
        />
      )}
    </button>
  )
}
