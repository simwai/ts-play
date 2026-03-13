import { useState, useRef, useCallback, useEffect } from 'react'

export function useResizePanel(
  initialHeight = 180,
  minHeight = 80,
  maxHeight = 400
) {
  const [panelHeight, setPanelHeight] = useState(initialHeight)
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
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, resizeStartHeight.current + deltaY)
      )
      setPanelHeight(newHeight)
    },
    [isResizing, minHeight, maxHeight]
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
