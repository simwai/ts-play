import { useEffect } from 'react'
import { TABS, type TabType } from '../lib/constants'

export function useAppKeyboardShortcuts(
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetElement = e.target as HTMLElement | null
      const isInput = /^(INPUT|TEXTAREA)$/.test(targetElement?.tagName || '')

      const isArrowKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      const isTabNavigation = isArrowKey && (!isInput || e.altKey)

      if (isTabNavigation) {
        e.preventDefault()
        setActiveTab((previous) => {
          const currentIndex = TABS.indexOf(previous)
          if (e.key === 'ArrowLeft') {
            const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length
            return TABS[prevIndex]
          }
          const nextIndex = (currentIndex + 1) % TABS.length
          return TABS[nextIndex]
        })
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [setActiveTab])
}
