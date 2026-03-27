import { useCallback, useRef, useState } from 'react'
import { db } from '../lib/db'
import { webContainerService } from '../lib/webcontainer'
import { usePlaygroundStore } from './usePlaygroundStore'

export function useCompilerManager() {
  const [isRunning, setIsRunning] = useState(false)
  const { isReady } = usePlaygroundStore()
  const currentProcRef = useRef<any>(null)

  const stopCode = useCallback(() => {
    if (currentProcRef.current) {
      currentProcRef.current.kill()
      currentProcRef.current = null
      setIsRunning(false)
      webContainerService.emitLog('info', 'Execution stopped by user.')
    }
  }, [])

  const runCode = useCallback(async () => {
    if (isRunning || !isReady) return

    setIsRunning(true)
    try {
      const proc = await webContainerService.spawnManaged('node', ['dist/index.js'])
      currentProcRef.current = proc

      const exitCode = await proc.exit
      currentProcRef.current = null

      if (exitCode === 0) {
        // Successful execution - capture snapshot
        try {
          const snapshot = await webContainerService.exportSnapshot()
          await db.saveSnapshot('playground', snapshot)
          webContainerService.emitLog('info', '✨ Environment snapshot saved to IndexedDB.')
        } catch (err: any) {
          console.error('Failed to save snapshot:', err)
          webContainerService.emitLog('error', `Failed to save snapshot: ${err.message}`)
        }
      } else if (exitCode !== null) {
        webContainerService.emitLog('error', `Process exited with code ${exitCode}`)
      }
    } catch (err: any) {
      webContainerService.emitLog('error', `Execution Error: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, isReady])

  return {
    runCode,
    stopCode,
    isRunning,
  }
}
