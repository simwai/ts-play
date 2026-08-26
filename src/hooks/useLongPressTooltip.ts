import { useState, useRef } from 'react'

// Shared long-press tooltip and press-feedback state for button controls:
// a 400 ms touch hold reveals the tooltip and swallows the resulting click.
export function useLongPressTooltip(
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
) {
  const [pressed, setPressed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
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

  return {
    pressed,
    showTooltip,
    pressHandlers: {
      onMouseLeave: () => setPressed(false),
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
    },
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove,
    },
    handleClick,
  }
}
