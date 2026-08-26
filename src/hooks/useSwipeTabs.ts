import { useRef, useCallback } from 'react'

function isInteractiveTarget(target: EventTarget | undefined | null) {
  if (!(target instanceof HTMLElement)) return false
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
  tabs: readonly T[] = [] as unknown as readonly T[],
  disabled: boolean = false
) {
  const swipeRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swiping = useRef(false)
  const startedOnInteractive = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const touch = e.touches[0]
      if (!touch) return
      startedOnInteractive.current = isInteractiveTarget(e.target)
      if (!startedOnInteractive.current) return
      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY
      swiping.current = false
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !startedOnInteractive.current) return
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current
      if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8)
        swiping.current = true
      if (swiping.current) e.preventDefault()
    },
    [disabled]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !startedOnInteractive.current || !swiping.current) return
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current
      if (Math.abs(dx) < Math.abs(dy) * 1.5 || Math.abs(dx) < 40) return
      const currentIndex = (tabs as readonly string[]).indexOf(activeTab)
      if (currentIndex === -1) return
      if (dx < 0) setActiveTab(tabs[(currentIndex + 1) % tabs.length] as T)
      else
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length] as T)
      swiping.current = false
    },
    [activeTab, disabled, setActiveTab, tabs]
  )

  return {
    swipeRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
