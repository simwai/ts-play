import { type CSSProperties, type ReactNode, useState, useRef } from 'react'
import { cn } from '../../utils/cn'

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
}

const sizeClasses: Record<Size, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
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
}: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isLongPress = useRef(false)

  const handleTouchStart = () => {
    isLongPress.current = false
    if (touchTimer.current) clearTimeout(touchTimer.current)
    touchTimer.current = setTimeout(() => {
      isLongPress.current = true
      setShowTooltip(true)
    }, 400)
  }

  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    setTimeout(() => {
      setShowTooltip(false)
    }, 2000)
  }

  const handleTouchMove = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    setShowTooltip(false)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isLongPress.current) {
      e.preventDefault()
      isLongPress.current = false
      return
    }
    onClick?.(e)
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      aria-label={title}
      onMouseLeave={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={cn(
        'group relative font-inherit rounded-md flex items-center justify-center gap-1.5 transition-all duration-150 whitespace-nowrap',
        sizeClasses[size],
        variant === 'primary' ? 'font-bold' : 'font-medium',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100',
        pressed && !disabled ? 'scale-95' : 'scale-100',
        {
          'bg-green text-[color:var(--crust)] hover:bg-teal border-none': variant === 'primary',
          'bg-surface0 text-text hover:bg-surface1 border border-surface1': variant === 'secondary',
          'bg-red/15 text-red hover:bg-red/25 border border-red/40 hover:border-red/60': variant === 'danger',
          'bg-transparent text-text hover:bg-surface0 border-none': variant === 'ghost',
        },
        className
      )}
      style={style}
    >
      {children}
      {title && (
        <div
          className={cn(
            'absolute top-full mt-2 px-2.5 py-1.5 bg-crust text-text text-xs font-mono rounded-md border border-surface1 shadow-lg z-50 pointer-events-none transition-opacity duration-150',
            'w-max max-w-64 whitespace-normal font-normal',
            tooltipAlign === 'center' && 'left-1/2 -translate-x-1/2 text-center',
            tooltipAlign === 'right' && 'right-0 text-right',
            tooltipAlign === 'left' && 'left-0 text-left',
            showTooltip ? 'opacity-100' : 'opacity-0',
            'group-hover:opacity-100'
          )}
        >
          {title}
        </div>
      )}
    </button>
  )
}
