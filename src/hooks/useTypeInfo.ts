import { useState, useCallback } from 'react'
import type { TypeInfo } from '../lib/types'

export function useTypeInfo(tsCursorPos: { current: number }) {
  const [rawTypeInfo, setRawTypeInfo] = useState<TypeInfo | null>(null)

  const handleTypeInfoChange = useCallback((info: TypeInfo | null) => {
    setRawTypeInfo(info)
  }, [])

  const handleCursorPosChange = useCallback(
    (pos: number) => {
      tsCursorPos.current = pos
    },
    [tsCursorPos]
  )

  return {
    rawTypeInfo,
    handleTypeInfoChange,
    handleCursorPosChange,
  }
}
