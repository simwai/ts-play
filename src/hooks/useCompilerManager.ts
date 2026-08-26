import { useState, useEffect, useCallback, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import { writeFiles, webContainerService } from '../lib/webcontainer'
import type { CompilerStatus, ConsoleMessageType } from '../lib/types'
import type { WebContainerProcess } from '@webcontainer/api'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessageType, args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] =
    useState<CompilerStatus>('loading')
  const [isRunning, setIsRunning] = useState(false)
  const currentProcess = useRef<WebContainerProcess | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false) // more robust gate

  // Initialization
  useEffect(() => {
    workerClient
      .init()
      .then(() => setCompilerStatus('ready'))
      .catch((error) => {
        console.error('Worker init failed:', error)
        setCompilerStatus('error')
      })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (currentProcess.current) {
        currentProcess.current.kill()
        currentProcess.current = null
      }
    }
  }, [])

  const stopCode = useCallback(() => {
    if (currentProcess.current) {
      currentProcess.current.kill()
      currentProcess.current = null
      addMessage('info', ['Execution stopped by user.'])
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsRunning(false)
    setCompilerStatus('ready') // reset status
  }, [addMessage])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      if (runningRef.current) return
      runningRef.current = true
      setIsRunning(true)
      setCompilerStatus('compiling')

      try {
        // Compile TypeScript
        const compiled = await workerClient.compile(tsCode)
        onSuccess(compiled.js, compiled.dts)

        // Write the resulting JS to the WebContainer
        await writeFiles({ 'index.js': compiled.js })

        // Wait for pending package installs (or timeout)
        try {
          await Promise.race([
            pendingInstalls,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Background tasks timed out')),
                10000
              )
            ),
          ])
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          addMessage('warn', [
            `Proceeding despite background task warning: ${msg}`,
          ])
        }

        // Launch Node.js
        setCompilerStatus('running')
        addMessage('info', ['Executing via Node.js...'])
        const proc = await webContainerService.spawnManaged(
          'node',
          ['index.js'],
          {
            onLog: (out) => {
              const clean = out.trim()
              if (clean) addMessage('log', [clean])
            },
          }
        )

        currentProcess.current = proc

        // 5‑minute timeout
        timeoutRef.current = setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill()
            currentProcess.current = null
            addMessage('error', ['Execution timed out after 5 minutes.'])
            setIsRunning(false)
            setCompilerStatus('ready')
          }
        }, 300000)

        const exitCode = await proc.exit

        // Clear timeout if process finishes on its own
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        currentProcess.current = null

        if (exitCode !== 0) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
      } catch (error) {
        onError(error as Error)
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
