import { useState, useRef, useCallback, useEffect } from 'react'

export function useResizePanel(
  initialHeightRem = 11.25, // 180px
  minHeightRem = 5, // 80px
  maxHeightRem = 25 // 400px
) {
  const [panelHeight, setPanelHeight] = useState(initialHeightRem)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setIsResizing(true)
      resizeStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY
      resizeStartHeight.current = panelHeight
    },
    [panelHeight]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const deltaY = resizeStartY.current - clientY

      // Convert pixel delta to rem based on root font size
      const remSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const deltaRem = deltaY / remSize

      const newHeight = Math.max(
        minHeightRem,
        Math.min(maxHeightRem, resizeStartHeight.current + deltaRem)
      )
      setPanelHeight(newHeight)
    },
    [isResizing, minHeightRem, maxHeightRem]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      globalThis.addEventListener('mousemove', handleResizeMove)
      globalThis.addEventListener('mouseup', handleResizeEnd)
      globalThis.addEventListener('touchmove', handleResizeMove, {
        passive: false,
      })
      globalThis.addEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      globalThis.removeEventListener('mousemove', handleResizeMove)
      globalThis.removeEventListener('mouseup', handleResizeEnd)
      globalThis.removeEventListener('touchmove', handleResizeMove)
      globalThis.removeEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  return { panelHeight, isResizing, handleResizeStart }
}
