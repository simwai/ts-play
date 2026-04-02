import { useState, useEffect } from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return initialValue

      // If initialValue is a string, we treat the stored item as a raw string.
      // This prevents "true" being parsed as boolean true, or JSON strings being parsed as objects.
      if (typeof initialValue === 'string') {
        return item as unknown as T
      }

      try {
        return JSON.parse(item) as T
      } catch {
        return item as unknown as T
      }
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      )
    } catch {
      /* quota / security — silently ignore */
    }
  }, [key, value])

  return [value, setValue]
}
