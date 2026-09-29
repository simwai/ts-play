import { useState, useRef } from 'react'

const LONG_PRESS_DELAY_MS = 400
const TOOLTIP_HIDE_DELAY_MS = 2000

export function useLongPressTooltip(
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
) {
  const [pressed, setPressed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const isLongPress = useRef(false)

  const clearTimer = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current)
    }
  }

  const handleTouchStart = () => {
    isLongPress.current = false
    clearTimer()
    touchTimer.current = setTimeout(() => {
      isLongPress.current = true
      setShowTooltip(true)
    }, LONG_PRESS_DELAY_MS)
  }

  const handleTouchEnd = () => {
    clearTimer()
    setTimeout(() => {
      setShowTooltip(false)
    }, TOOLTIP_HIDE_DELAY_MS)
  }

  const handleTouchMove = () => {
    clearTimer()
    setShowTooltip(false)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const isHoldAction = isLongPress.current
    if (isHoldAction) {
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
