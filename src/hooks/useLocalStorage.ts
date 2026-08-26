import { useState, useEffect, useCallback, useRef } from 'react'

const PERSIST_DELAY_MS = 300

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const valueRef = useRef(value)
  valueRef.current = value

  // Trailing-debounce persistence – keystroke-heavy editors would otherwise
  // stringify and write on every change.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(valueRef.current))
      } catch {}
    }, PERSIST_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key, value])

  // Flush the pending debounce on unmount or key switch so nothing is lost.
  useEffect(() => {
    return () => {
      try {
        localStorage.setItem(key, JSON.stringify(valueRef.current))
      } catch {}
    }
  }, [key])

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue)
  }, [])

  return [value, setStoredValue] as const
}
