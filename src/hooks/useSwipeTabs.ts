import { useRef, useCallback } from 'react'

function isInteractiveTarget(target: EventTarget | undefined | null) {
  const isHtmlElement = target instanceof HTMLElement
  if (!isHtmlElement) return false

  const isResizeHandle = Boolean(target.closest('.cursor-ns-resize'))
  if (isResizeHandle) return false

  const isHeader = Boolean(target.closest('header'))
  const isCrustBackground = Boolean(target.closest('.bg-crust'))
  const isMonoPanelHeader = Boolean(target.closest('.font-mono.shrink-0'))

  return isHeader || isCrustBackground || isMonoPanelHeader
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
      const isMoveDisabled = disabled || !startedOnInteractive.current
      if (isMoveDisabled) return

      const touch = e.touches[0]
      if (!touch) return

      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current

      const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy)
      const exceedsThreshold = Math.abs(dx) > 8

      if (!swiping.current && isHorizontalSwipe && exceedsThreshold) {
        swiping.current = true
      }

      if (swiping.current) {
        e.preventDefault()
      }
    },
    [disabled]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const isEndDisabled =
        disabled || !startedOnInteractive.current || !swiping.current
      if (isEndDisabled) return

      const touch = e.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - touchStartX.current
      const dy = touch.clientY - touchStartY.current

      const isVerticalDominant = Math.abs(dx) < Math.abs(dy) * 1.5
      const isDistanceTooShort = Math.abs(dx) < 40
      if (isVerticalDominant || isDistanceTooShort) return

      const currentIndex = (tabs as readonly string[]).indexOf(activeTab)
      if (currentIndex === -1) return

      const isSwipeLeft = dx < 0
      if (isSwipeLeft) {
        const nextIndex = (currentIndex + 1) % tabs.length
        setActiveTab(tabs[nextIndex] as T)
      } else {
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        setActiveTab(tabs[prevIndex] as T)
      }
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
