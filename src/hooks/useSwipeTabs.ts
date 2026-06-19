import { useRef, useCallback } from 'react'

function isInteractiveTarget(target: EventTarget | undefined | null) {
  if (!(target instanceof HTMLElement)) return false
  // Don't swipe if touching the editor or the resize handle
  if (target.closest('[data-testid="code-editor-container"]')) return false
  if (target.closest('.cursor-ns-resize')) return false

  // Only allow swipe if touching the header, status bar, or type info bar
  return (
    Boolean(target.closest('header')) ||
    Boolean(target.closest('.bg-crust')) || // StatusBar
    Boolean(target.closest('.font-mono.shrink-0')) // TypeInfoBar or Console Header
  )
}

export function useSwipeTabs<T extends string>(
  activeTab: T,
  setActiveTab: (tab: T) => void,
  tabs: readonly T[],
  disabled: boolean
) {
  const swipeRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const target = e.target as HTMLElement
      if (!isInteractiveTarget(target)) return
      const touch = e.touches[0]
      if (!touch) return
      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY
      swiping.current = false
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const target = e.target as HTMLElement
      if (!isInteractiveTarget(target)) return
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current
      if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        swiping.current = true
      }

      if (swiping.current) e.preventDefault()
    },
    [disabled]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const target = e.target as HTMLElement
      if (!isInteractiveTarget(target)) return
      if (!swiping.current) return
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (Math.abs(dx) < 40) return

      const currentIndex = tabs.indexOf(activeTab)

      if (dx < 0) {
        const nextIndex = (currentIndex + 1) % tabs.length
        const nextTab = tabs[nextIndex]
        if (nextTab) setActiveTab(nextTab)
      } else {
        const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length
        const prevTab = tabs[previousIndex]
        if (prevTab) setActiveTab(prevTab)
      }

      swiping.current = false
    },
    [activeTab, disabled, setActiveTab, tabs]
  )

  return { swipeRef, onTouchStart, onTouchMove, onTouchEnd }
}
