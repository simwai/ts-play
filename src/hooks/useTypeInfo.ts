import { useState, useCallback } from 'react'

export function useTypeInfo(tsCursorPos: { current: number }) {
  const [typeInfo, setTypeInfo] = useState<string>('')

  const handleTypeInfoChange = useCallback((info: string) => {
    setTypeInfo(info)
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
