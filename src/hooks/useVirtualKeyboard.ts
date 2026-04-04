import { useEffect, useState } from 'react'

export function useVirtualKeyboard() {
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [isMobileLike, setIsMobileLike] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileLike(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768
      )
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    if ('visualViewport' in window && window.visualViewport) {
      const handler = () => {
        if (!window.visualViewport) return
        const isOpen = window.visualViewport.height < window.innerHeight * 0.8
        setKeyboardOpen(isOpen)
      }
      window.visualViewport.addEventListener('resize', handler)
      return () => {
        window.removeEventListener('resize', checkMobile)
        window.visualViewport?.removeEventListener('resize', handler)
      }
    }

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return { keyboardOpen, isMobileLike }
}
