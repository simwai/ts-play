import { useState, useCallback, useRef, useEffect } from 'react'

export function useResizePanel(initialHeight: number) {
  const [panelHeight, setPanelHeight] = useState(initialHeight)
  const isResizing = useRef(false)

  const startResizing = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const stopResizing = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return
    const newHeight = window.innerHeight - e.clientY
    // Constrain height between 100px and 80% of window height
    setPanelHeight(Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)))
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [onMouseMove, stopResizing])

  return { panelHeight, startResizing }
}
