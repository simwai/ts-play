import { useCallback } from 'react'
import { workerClient } from '../lib/workerClient'

export type TypeInfo = {
  name: string
  kind: string
  typeAnnotation: string
  signature?: string
  jsDoc?: string
  detail?: string
}

export function useTypeInfo() {
  const getTypeInfo = useCallback(
    async (code: string, offset: number): Promise<TypeInfo | undefined> => {
      try {
        await workerClient.updateFile('main.ts', code)
        return await workerClient.getTypeInfo(offset)
      } catch {
        return
      }
    },
    []
  )

  return { getTypeInfo }
}
