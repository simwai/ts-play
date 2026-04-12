import { useRef, useCallback } from 'react'

function isInteractiveTarget(target: EventTarget | undefined | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('[data-testid="code-editor-container"]')) return false
  if (target.closest('.cursor-ns-resize')) return false

  return (
    Boolean(target.closest('header')) ||
    Boolean(target.closest('.bg-crust')) ||
    Boolean(target.closest('.font-mono.shrink-0'))
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
      if (!isInteractiveTarget(e.target)) return
      touchStartX.current = e.touches[0]?.clientX ?? 0
      touchStartY.current = e.touches[0]?.clientY ?? 0
      swiping.current = false
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      if (!isInteractiveTarget(e.target)) return
      const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current
      const dy = (e.touches[0]?.clientY ?? 0) - touchStartY.current
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
      if (!isInteractiveTarget(e.target)) return
      if (!swiping.current) return
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
      const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (Math.abs(dx) < 40) return

      const currentIndex = tabs.indexOf(activeTab)

      if (dx < 0) {
        const nextIndex = (currentIndex + 1) % tabs.length
        const nextTab = tabs[nextIndex]
        if (nextTab !== undefined) setActiveTab(nextTab)
      } else {
        const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length
        const prevTab = tabs[previousIndex]
        if (prevTab !== undefined) setActiveTab(prevTab)
      }

      swiping.current = false
    },
    [activeTab, disabled, setActiveTab, tabs]
  )

  return { swipeRef, onTouchStart, onTouchMove, onTouchEnd }
}
