import { useState, useEffect, useCallback, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand } from '../lib/webcontainer'
import type { ConsoleMessage } from '../components/Console'
import type { WebContainerProcess } from '@webcontainer/api'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [isRunning, setIsRunning] = useState(false)
  const currentProcess = useRef<WebContainerProcess | null>(null)
  const timeoutRef = useRef<number | null>(null)

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
  }, [addMessage])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      setIsRunning(true)
      try {
        const compiled = await workerClient.compile(tsCode)
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({
          'index.js': compiled.js,
        })

        // Wait for any background npm installs/uninstalls to finish
        await pendingInstalls

        addMessage('info', ['Executing via Node.js...'])
        const { exit, process } = await runCommand('node', ['index.js'], (out) => {
          if (out.trim()) addMessage('log', [out.trim()])
        })

        currentProcess.current = process

        // Set 5 minute timeout
        timeoutRef.current = window.setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill()
            currentProcess.current = null
            addMessage('error', ['Execution timed out after 5 minutes.'])
            setIsRunning(false)
          }
        }, 300000)

        const exitCode = await exit

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        currentProcess.current = null

        if (exitCode !== 0 && isRunning) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
      } catch (error) {
        onError(error as Error)
      } finally {
        setIsRunning(false)
      }
    },
    [tsCode, addMessage, isRunning]
  )

  return { compilerStatus, isRunning, runCode, stopCode }
}
