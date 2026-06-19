import { useRef, useCallback } from 'react'

function isEditorTarget(target: EventTarget | undefined | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('[data-testid="code-editor-container"]'))
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

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      if (isEditorTarget(e.target)) return
      const touch = e.touches[0]
      if (touch) {
        touchStartX.current = touch.clientX
        touchStartY.current = touch.clientY
      }
      swiping.current = false
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      if (isEditorTarget(e.target)) return
      const touch = e.touches[0]
      if (touch) {
        const dx = touch.clientX - touchStartX.current
        const dy = touch.clientY - touchStartY.current
        if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
          swiping.current = true
        }
      }

      if (swiping.current) e.preventDefault()
    },
    [disabled]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      if (isEditorTarget(e.target)) return
      if (!swiping.current) return
      const touch = e.changedTouches[0]
      if (touch) {
        const dx = touch.clientX - touchStartX.current
        const dy = touch.clientY - touchStartY.current
        if (Math.abs(dx) < Math.abs(dy) * 1.5) return
        if (Math.abs(dx) < 40) return

        const currentIndex = (tabs as readonly string[]).indexOf(activeTab)
        if (currentIndex === -1) return

        if (dx < 0) {
          const nextIndex = (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex] as T)
        } else {
          const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setActiveTab(tabs[previousIndex] as T)
        }
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
    compactForKeyboard: false,
  }
}
