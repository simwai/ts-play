import { useEffect, useMemo, useState, useRef } from 'react'

type VKState = {
  keyboardOpen: boolean
  keyboardHeight: number
  isMobileLike: boolean
}

function activeTextTarget() {
  const element = document.activeElement as HTMLElement | undefined
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return true
  return Boolean(element.closest('[contenteditable="true"]'))
}

export function useVirtualKeyboard(): VKState {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const baselineHeight = useRef(0)

  useEffect(() => {
    const vv = window.visualViewport
    const handleOrientation = () => {
      setKeyboardHeight(0)
      baselineHeight.current = vv?.height ?? window.innerHeight
    }

    const handleFocusOut = () => {
      setKeyboardHeight(0)
      baselineHeight.current = vv?.height ?? window.innerHeight
    }

    const measure = () => {
      const viewportHeight = vv?.height ?? window.innerHeight

      if (!baselineHeight.current) {
        baselineHeight.current = viewportHeight
      } else if (
        !activeTextTarget() &&
        viewportHeight > baselineHeight.current
      ) {
        baselineHeight.current = viewportHeight
      }

      const base = baselineHeight.current || viewportHeight
      const delta = Math.max(0, Math.round(base - viewportHeight))
      const open = activeTextTarget() && delta > 120
      setKeyboardHeight(open ? delta : 0)
    }

    measure()
    vv?.addEventListener('resize', measure)
    vv?.addEventListener('scroll', measure)
    globalThis.addEventListener('focusin', measure)
    globalThis.addEventListener('focusout', handleFocusOut)
    globalThis.addEventListener('orientationchange', handleOrientation)

    return () => {
      vv?.removeEventListener('resize', measure)
      vv?.removeEventListener('scroll', measure)
      globalThis.removeEventListener('focusin', measure)
      globalThis.removeEventListener('focusout', handleFocusOut)
      globalThis.removeEventListener('orientationchange', handleOrientation)
    }
  }, [])

  const isMobileLike = useMemo(() => {
    return (
      globalThis.matchMedia?.('(max-width: 820px)').matches ??
      window.innerWidth <= 820
    )
  }, [])

  return {
    keyboardOpen: keyboardHeight > 0,
    keyboardHeight,
    isMobileLike,
  }
}
