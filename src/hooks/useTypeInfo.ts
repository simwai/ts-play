import { useCallback } from 'react'
import { workerClient } from '../lib/workerClient'
import type { TypeInfo } from '../lib/types'
export function useTypeInfo() {
  const getTypeInfo = useCallback(
    async (code: string, offset: number): Promise<TypeInfo | undefined> => {
      try {
        await workerClient.updateFile('/main.ts', code)
        return await workerClient.getTypeInfo(offset)
      } catch {
        return
      }
    },
    []
  )

  return { getTypeInfo }
}
