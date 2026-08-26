import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { useLongPressTooltip } from '../../hooks/useLongPressTooltip'
import { Tooltip } from './Tooltip'

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

const sizeClasses: Record<Size, string> = {
  xs: 'h-5 md:h-7 px-1.5 md:px-2.5 text-4xs md:text-xs',
  sm: 'h-6 md:h-8 px-2 md:px-3 text-3xs md:text-sm',
  md: 'h-8 md:h-10 px-3 md:px-4 text-xs md:text-base',
  lg: 'h-10 md:h-12 px-4 md:px-5 text-sm md:text-lg',
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
