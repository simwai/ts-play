import { useState, useEffect, useCallback } from 'react'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand } from '../lib/webcontainer'
import type { ConsoleMessage } from '../components/Console'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [compilerStatus, setCompilerStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [isRunning, setIsRunning] = useState(false)

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
        const exitCode = await runCommand('node', ['index.js'], (out) => {
          // Do NOT strip ANSI codes if we want to support them in the console
          if (out.trim()) addMessage('log', [out.trim()])
        })

        if (exitCode !== 0) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
      } catch (error) {
        onError(error as Error)
      } finally {
        setIsRunning(false)
      }
    },
    [tsCode, addMessage]
  )

  return { compilerStatus, isRunning, runCode }
}
