import { useState, useEffect, useCallback, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand } from '../lib/webcontainer'
import type { CompilerStatus } from '../lib/types'
import type { WebContainerProcess } from '@webcontainer/api'
import type { ConsoleMessage } from '../components/Console'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] =
    useState<CompilerStatus>('loading')
  const [isRunning, setIsRunning] = useState(false)
  const isRunningRef = useRef(false)
  const currentProcess = useRef<WebContainerProcess | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    workerClient
      .init()
      .then(() => {
        setCompilerStatus('ready')
      })
      .catch((error) => {
        console.error('Worker init failed:', error)
        setCompilerStatus('error')
      })
  }, [])

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {
        /* Silent */
      })
    }
  }, [compilerStatus])

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
    isRunningRef.current = false
  }, [addMessage])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      if (isRunningRef.current) return
      isRunningRef.current = true
      setIsRunning(true)
      setCompilerStatus('compiling')

      try {
        const compiled = await workerClient.compile(tsCode)
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({
          'index.js': compiled.js,
        })

        // Wait for background tasks if any
        await Promise.race([
          pendingInstalls,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Background tasks timed out')),
              10000
            )
          ),
        ]).catch((e) => {
          console.warn('Proceeding despite background task warning:', e.message)
        })

        setCompilerStatus('running')
        addMessage('info', ['Executing via Node.js...'])
        const { exit, process } = await runCommand(
          'node',
          ['index.js'],
          (out) => {
            const clean = out.trim()
            if (clean) addMessage('log', [clean])
          }
        )

        currentProcess.current = process

        timeoutRef.current = setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill()
            currentProcess.current = null
            addMessage('error', ['Execution timed out after 5 minutes.'])
            setIsRunning(false)
            isRunningRef.current = false
            setCompilerStatus('ready')
          }
        }, 300000)

        const exitCode = await exit

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
        isRunningRef.current = false
        setCompilerStatus('ready')
      }
    },
    [tsCode, addMessage]
  )

  return { compilerStatus, isRunning, runCode, stopCode }
}
