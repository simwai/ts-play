import { useState, useRef, useCallback, useEffect } from 'react'

export function useResizePanel(
  initialHeightRem = 11.25,
  minHeightRem = 5,
  maxHeightRem = 25
) {
  const [panelHeight, setPanelHeight] = useState(initialHeightRem)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0]?.clientY ?? 0 : (e as React.MouseEvent).clientY
      resizeStartY.current = clientY
      resizeStartHeight.current = panelHeight
    },
    [panelHeight]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return
      const clientY = 'touches' in e ? ((e as TouchEvent).touches[0]?.clientY ?? 0) : (e as MouseEvent).clientY
      const deltaY = resizeStartY.current - clientY
      const remSize = parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16
      const deltaRem = deltaY / remSize
      setPanelHeight(Math.max(minHeightRem, Math.min(maxHeightRem, resizeStartHeight.current + deltaRem)))
    },
    [isResizing, minHeightRem, maxHeightRem]
  )

  const handleResizeEnd = useCallback(() => setIsResizing(false), [])

  useEffect(() => {
    if (isResizing) {
      globalThis.addEventListener('mousemove', handleResizeMove)
      globalThis.addEventListener('mouseup', handleResizeEnd)
      globalThis.addEventListener('touchmove', handleResizeMove, { passive: false })
      globalThis.addEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = 'ns-resize'
    }
    return () => {
      globalThis.removeEventListener('mousemove', handleResizeMove)
      globalThis.removeEventListener('mouseup', handleResizeEnd)
      globalThis.removeEventListener('touchmove', handleResizeMove)
      globalThis.removeEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = ''
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  return { panelHeight, isResizing, startResizing: handleResizeStart }
}
