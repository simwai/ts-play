import { type CSSProperties, type ReactNode, useState, useRef } from 'react'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  children: ReactNode
  variant?: Variant
  title?: string
  tooltipAlign?: 'center' | 'right' | 'left'
  style?: CSSProperties
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  onClick,
  disabled = false,
  children,
  variant = 'secondary',
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
    // Tooltip auf Mobile nach dem Loslassen noch 2 Sekunden anzeigen
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
      onMouseLeave={() => {
        setPressed(false)
      }}
      onMouseDown={() => {
        setPressed(true)
      }}
      onMouseUp={() => {
        setPressed(false)
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={cn(
        'group relative px-[14px] py-[7px] text-[13px] font-inherit rounded-[5px] flex items-center gap-[5px] transition-all duration-120 whitespace-nowrap',
        variant === 'primary' ? 'font-bold' : 'font-medium',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer opacity-100',
        pressed && !disabled ? 'scale-[0.97]' : 'scale-100',
        {
          'bg-green text-crust hover:bg-teal border-none':
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
        <div
          className={cn(
            'absolute top-full mt-1.5 px-2 py-1 bg-crust text-text text-[11px] font-mono rounded border border-surface1 shadow-md z-50 whitespace-nowrap pointer-events-none transition-opacity duration-150',
            tooltipAlign === 'center' && 'left-1/2 -translate-x-1/2',
            tooltipAlign === 'right' && 'right-0',
            tooltipAlign === 'left' && 'left-0',
            showTooltip
              ? 'opacity-100 visible'
              : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'
          )}
        >
          {title}
        </div>
      )}
    </button>
  )
}
