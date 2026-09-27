import { useEffect } from 'react'
import { TABS, type TabType } from '../lib/constants'
import type { Dispatch, SetStateAction } from 'react'

export function useKeyboardShortcuts(
  activeTab: TabType,
  setActiveTab: Dispatch<SetStateAction<TabType>>
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = /^(INPUT|TEXTAREA)$/.test(
        (e.target as HTMLElement)?.tagName || ''
      )

      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        (!isInput || e.altKey)
      ) {
        e.preventDefault()
        setActiveTab((previous: TabType): TabType => {
          const idx = TABS.indexOf(previous)
          if (e.key === 'ArrowLeft') {
            return TABS[(idx - 1 + TABS.length) % TABS.length]
          }
          return TABS[(idx + 1) % TABS.length]
        })
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTab, setActiveTab])
}
