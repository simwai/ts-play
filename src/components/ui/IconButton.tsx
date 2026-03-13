import { type CSSProperties, type ReactNode, useState, useRef } from 'react'
import { cn } from '../../utils/cn'

type IconButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
  tooltipAlign?: 'center' | 'right' | 'left'
  disabled?: boolean
  children: ReactNode
  variant?: 'ghost' | 'surface' | 'danger'
  size?: 'sm' | 'md'
  style?: CSSProperties
  className?: string
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
}: IconButtonProps) {
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
        'group relative rounded-[5px] text-[13px] leading-none flex items-center justify-center shrink-0 transition-all duration-120',
        size === 'sm' ? 'px-[6px] py-[3px]' : 'px-[9px] py-[5px]',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer opacity-100',
        pressed && !disabled ? 'scale-[0.93]' : 'scale-100',
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
        <div
          className={cn(
            'absolute top-full mt-1.5 px-2 py-1 bg-crust text-text text-[11px] font-mono rounded border border-surface1 shadow-md z-50 pointer-events-none transition-opacity duration-150',
            'w-max max-w-[250px] whitespace-normal',
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
