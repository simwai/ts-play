import { useState, useEffect } from 'react'
import { Result } from 'neverthrow'

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const itemResult = Result.fromThrowable(() => localStorage.getItem(key))()

    return itemResult.match(
      (item) => {
        if (item === null) return initialValue

        if (typeof initialValue === 'string') {
          return item as unknown as T
        }

        return Result.fromThrowable(() => JSON.parse(item))()
          .match(
            (parsed) => parsed as T,
            () => item as unknown as T
          )
      },
      () => initialValue
    )
  })

  useEffect(() => {
    Result.fromThrowable(() => {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      )
    })()
  }, [key, value])

  return [value, setValue]
}
