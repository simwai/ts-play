import { useRef, useCallback } from 'react'

function isEditorTarget(target: EventTarget | undefined | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('[data-testid="code-editor-container"]'))
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
      if (isEditorTarget(e.target)) return
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      swiping.current = false
    },
    [disabled]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      if (isEditorTarget(e.target)) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
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
      if (isEditorTarget(e.target)) return
      if (!swiping.current) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (Math.abs(dx) < 40) return

      const currentIndex = tabs.indexOf(activeTab)

      if (dx < 0) {
        const nextIndex = (currentIndex + 1) % tabs.length
        setActiveTab(tabs[nextIndex])
      } else {
        const previousIndex = (currentIndex - 1 + tabs.length) % tabs.length
        setActiveTab(tabs[previousIndex])
      }

      swiping.current = false
    },
    [activeTab, disabled, setActiveTab, tabs]
  )

  return { swipeRef, onTouchStart, onTouchMove, onTouchEnd }
}
