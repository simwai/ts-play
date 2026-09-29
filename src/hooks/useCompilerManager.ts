import { useState, useEffect, useCallback, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import { writeFiles, webContainerService } from '../lib/webcontainer'
import type { CompilerStatus, ConsoleMessageType } from '../lib/types'
import type { WebContainerProcess } from '@webcontainer/api'

const EXECUTION_TIMEOUT_MS = 300_000 // 5 minutes
const BACKGROUND_TASK_TIMEOUT_MS = 10_000

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessageType, args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] =
    useState<CompilerStatus>('loading')
  const [isRunning, setIsRunning] = useState(false)
  const currentProcess = useRef<WebContainerProcess | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      try {
        await workerClient.init()
        setCompilerStatus('ready')
      } catch (error) {
        console.error('Worker init failed:', error)
        setCompilerStatus('error')
      }
    })()
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (currentProcess.current) {
        currentProcess.current.kill()
        currentProcess.current = null
      }
    }
  }, [])

  const stopCode = useCallback(() => {
    const hasActiveProcess = Boolean(currentProcess.current)
    if (hasActiveProcess) {
      currentProcess.current?.kill()
      currentProcess.current = null
      addMessage('info', ['Execution stopped by user.'])
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsRunning(false)
    setCompilerStatus('ready')
  }, [addMessage])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      const isAlreadyRunning = runningRef.current
      if (isAlreadyRunning) return

      runningRef.current = true
      setIsRunning(true)
      setCompilerStatus('compiling')

      try {
        const compiled = await workerClient.compile(tsCode)
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({ 'index.js': compiled.js })

        try {
          await Promise.race([
            pendingInstalls,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Background tasks timed out')),
                BACKGROUND_TASK_TIMEOUT_MS
              )
            ),
          ])
        } catch (err: unknown) {
          const msg = getErrorMessage(err)
          addMessage('warn', [
            `Proceeding despite background task warning: ${msg}`,
          ])
        }

        setCompilerStatus('running')
        addMessage('info', ['Executing via Node.js...'])
        const proc = await webContainerService.spawnManaged(
          'node',
          ['index.js'],
          {
            onLog: (out) => {
              const clean = out.trim()
              const isNonEmpty = Boolean(clean)
              if (isNonEmpty) addMessage('log', [clean])
            },
          }
        )

        currentProcess.current = proc

        timeoutRef.current = setTimeout(() => {
          const isProcessActive = Boolean(currentProcess.current)
          if (isProcessActive) {
            currentProcess.current?.kill()
            currentProcess.current = null
            addMessage('error', ['Execution timed out after 5 minutes.'])
            setIsRunning(false)
            setCompilerStatus('ready')
          }
        }, EXECUTION_TIMEOUT_MS)

        const exitCode = await proc.exit

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        currentProcess.current = null

        const isUnsuccessfulExit = exitCode !== 0
        if (isUnsuccessfulExit) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        onError(err)
      } finally {
        setIsRunning(false)
        setCompilerStatus('ready')
        runningRef.current = false
      }
    },
    [tsCode, addMessage]
  )

  return { compilerStatus, isRunning, runCode, stopCode }
}
