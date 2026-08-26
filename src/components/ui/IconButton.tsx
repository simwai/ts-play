import { type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { useLongPressTooltip } from '../../hooks/useLongPressTooltip'
import { Tooltip } from './Tooltip'

type Size = 'xs' | 'sm' | 'md' | 'lg'

type IconButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  tooltipAlign?: 'center' | 'right' | 'left'
  disabled?: boolean
  children: ReactNode
  variant?: 'ghost' | 'surface' | 'danger'
  size?: Size
  style?: CSSProperties
  className?: string
  'data-testid'?: string
}

const sizeClasses: Record<Size, string> = {
  xs: 'w-5 h-5 md:w-7 md:h-7 text-xs',
  sm: 'w-6 h-6 md:w-8 md:h-8 text-sm',
  md: 'w-8 h-8 md:w-10 md:h-10 text-base',
  lg: 'w-10 h-10 md:w-12 md:h-12 text-lg',
}

export function IconButton({
  onClick,
  title,
  tooltipAlign = 'center',
  disabled = false,
  children,
  variant = 'surface',
  size = 'md',
  style,
  className,
  'data-testid': dataTestId,
}: IconButtonProps) {
  const { pressed, showTooltip, pressHandlers, touchHandlers, handleClick } =
    useLongPressTooltip(onClick)

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={title}
      data-testid={dataTestId}
      {...pressHandlers}
      {...touchHandlers}
      className={cn(
        'group relative rounded-md leading-none flex items-center justify-center shrink-0 transition-all duration-150',
        sizeClasses[size],
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer opacity-100',
        pressed && !disabled ? 'scale-95' : 'scale-100',
        {
          'bg-transparent hover:bg-surface0 text-text border-none':
            variant === 'ghost',
          'bg-red/15 hover:bg-red/28 text-red border border-red/44 hover:border-red/60':
            variant === 'danger',
          'bg-surface0 hover:bg-surface1 text-text border border-surface1':
            variant === 'surface',
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
