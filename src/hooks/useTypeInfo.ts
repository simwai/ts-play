import { useState, useCallback, useRef } from 'react'
import type { TypeInfo } from '../lib/types'

export function useTypeInfo() {
  const [typeInfo, setTypeInfo] = useState<string | null>(null)
  const lastInfoRef = useRef<TypeInfo | null>(null)

  const handleTypeInfoChange = useCallback((info: TypeInfo | null) => {
    if (!info) {
      setTypeInfo(null)
      lastInfoRef.current = null
      return
    }

    if (
      lastInfoRef.current &&
      lastInfoRef.current.name === info.name &&
      lastInfoRef.current.typeAnnotation === info.typeAnnotation
    ) {
      return
    }

    lastInfoRef.current = info

    let display = info.typeAnnotation
    if (info.jsDoc) {
      display += ' \n ' + info.jsDoc
    }
    setTypeInfo(display)
  }, [])

  return {
    typeInfo,
    handleTypeInfoChange,
  }
}
