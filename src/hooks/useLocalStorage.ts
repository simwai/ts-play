import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const item = localStorage.getItem(key)
    if (item === null) return initialValue
    try {
      return JSON.parse(item) as T
    } catch {
      return (item as unknown) as T
    }
  })

  useEffect(() => {
    const toStore = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, toStore)
  }, [key, value])

  return [value, setValue] as const
}
