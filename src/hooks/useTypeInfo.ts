import { useState, useCallback } from 'react'
import type { TypeInfo } from '../lib/types'

export function useTypeInfo(tsCursorPos: { current: number }) {
  const [typeInfo, setTypeInfo] = useState<string>('')

  const handleTypeInfoChange = useCallback((info: TypeInfo | null) => {
    if (!info) {
      setTypeInfo('')
    } else {
      setTypeInfo(info.typeAnnotation || '')
    }
  }, [])

  const handleCursorPosChange = useCallback((pos: number) => {
    tsCursorPos.current = pos
  }, [tsCursorPos])

  return {
    typeInfo,
    handleTypeInfoChange,
    handleCursorPosChange,
  }
}
