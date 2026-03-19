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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use a ref for tsCode to avoid unnecessary re-creations of runCode
  // while still having access to the latest code when it's eventually called.
  const codeRef = useRef(tsCode)
  useEffect(() => {
    codeRef.current = tsCode
  }, [tsCode])

  useEffect(() => {
    workerClient
      .init()
      .then(() => setCompilerStatus('ready'))
      .catch((error) => {
        console.error('Worker init failed:', error)
        setCompilerStatus('error')
      })
  }, [])

  useEffect(() => {
    if (compilerStatus === 'ready') {
      loadPrettier().catch(() => {})
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
      // Avoid concurrent runs
      if (isRunning) return
      setIsRunning(true)

      try {
        const codeToCompile = codeRef.current
        const compiled = await workerClient.compile(codeToCompile)
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({ 'index.js': compiled.js })

        // Wait for installations but don't block forever
        const installTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Package installation timed out')),
            15000
          )
        )

        await Promise.race([pendingInstalls, installTimeout]).catch((e) => {
          console.warn('Proceeding with execution:', e.message)
        })

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
      }
    },
    [addMessage, isRunning]
  )

  return { compilerStatus, isRunning, runCode, stopCode }
}
