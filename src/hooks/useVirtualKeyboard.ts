import { useEffect, useMemo, useState, useRef } from 'react'

type VirtualKeyboardState = {
  keyboardOpen: boolean
  keyboardHeight: number
  isMobileLike: boolean
}

function isActiveTextTarget(): boolean {
  const activeElement = document.activeElement as HTMLElement | undefined
  if (!activeElement) return false

  const isTextArea = activeElement instanceof HTMLTextAreaElement
  const isInput = activeElement instanceof HTMLInputElement
  const isContentEditable = Boolean(activeElement.closest('[contenteditable="true"]'))

  return isTextArea || isInput || isContentEditable
}

export function useVirtualKeyboard(): VirtualKeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const baselineHeight = useRef(0)

  useEffect(() => {
    const visualViewport = window.visualViewport

    const handleOrientation = () => {
      setKeyboardHeight(0)
      baselineHeight.current = visualViewport?.height ?? window.innerHeight
    }

    const handleFocusOut = () => {
      setKeyboardHeight(0)
      baselineHeight.current = visualViewport?.height ?? window.innerHeight
    }

    const measureKeyboard = () => {
      const currentViewportHeight = visualViewport?.height ?? window.innerHeight

      const isBaselineUnset = !baselineHeight.current
      const isExpandedWithoutFocus =
        !isActiveTextTarget() && currentViewportHeight > baselineHeight.current

      if (isBaselineUnset) {
        baselineHeight.current = currentViewportHeight
      } else if (isExpandedWithoutFocus) {
        baselineHeight.current = currentViewportHeight
      }

      const effectiveBaseHeight = baselineHeight.current || currentViewportHeight
      const heightDeltaPx = Math.max(0, Math.round(effectiveBaseHeight - currentViewportHeight))
      const isKeyboardActive = isActiveTextTarget() && heightDeltaPx > 120

      setKeyboardHeight(isKeyboardActive ? heightDeltaPx : 0)
    }

    measureKeyboard()
    visualViewport?.addEventListener('resize', measureKeyboard)
    visualViewport?.addEventListener('scroll', measureKeyboard)
    globalThis.addEventListener('focusin', measureKeyboard)
    globalThis.addEventListener('focusout', handleFocusOut)
    globalThis.addEventListener('orientationchange', handleOrientation)

    return () => {
      visualViewport?.removeEventListener('resize', measureKeyboard)
      visualViewport?.removeEventListener('scroll', measureKeyboard)
      globalThis.removeEventListener('focusin', measureKeyboard)
      globalThis.removeEventListener('focusout', handleFocusOut)
      globalThis.removeEventListener('orientationchange', handleOrientation)
    }
  }, [])

  const isMobileLike = useMemo(() => {
    const hasMediaMatch = globalThis.matchMedia?.('(max-width: 820px)').matches
    const isNarrowWidth = window.innerWidth <= 820
    return hasMediaMatch ?? isNarrowWidth
  }, [])

  return {
    keyboardOpen: keyboardHeight > 0,
    keyboardHeight,
    isMobileLike,
  }
}
