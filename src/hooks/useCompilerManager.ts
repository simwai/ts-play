import { useState, useEffect, useCallback, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { compilerMachine } from '../lib/machines/compilerMachine'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand } from '../lib/webcontainer'
import type { CompilerStatus } from '../lib/types'
import type { WebContainerProcess } from '@webcontainer/api'
import type { ConsoleMessage } from '../lib/types'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [state, send] = useMachine(compilerMachine)
  const currentProcess = useRef<WebContainerProcess | null>(null)

  const compilerStatus: CompilerStatus = state.matches('idle') ? 'ready' :
                                       state.matches('compiling') ? 'compiling' :
                                       state.matches('running') ? 'running' :
                                       state.matches('error') ? 'error' : 'loading'

  const isRunning = state.matches('running')

  useEffect(() => {
    workerClient
      .init()
      .then(res => {
          res.match(
            () => send({ type: 'BOOT_SUCCESS' }),
            (error) => {
                console.error('Worker init failed:', error)
                send({ type: 'BOOT_FAILURE', error: error.message })
            }
          )
      })
  }, [send])

  useEffect(() => {
    if (state.matches('idle')) {
      loadPrettier().catch(() => {})
    }
  }, [state])

  const stopCode = useCallback(() => {
    if (currentProcess.current) {
      currentProcess.current.kill()
      currentProcess.current = null
      addMessage('info', ['Execution stopped by user.'])
    }
    send({ type: 'STOP' })
  }, [addMessage, send])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      if (isRunning) return
      send({ type: 'START' })

      try {
        const compileRes = await workerClient.compile(tsCode)
        if (compileRes.isErr()) {
            throw compileRes.error
        }
        const compiled = compileRes.value
        onSuccess(compiled.js, compiled.dts)

        await writeFiles({
          'index.js': compiled.js,
        })

        await Promise.race([
          pendingInstalls,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Background tasks timed out')), 10000)
          ),
        ]).catch((e) => {
          console.warn('Proceeding despite background task warning:', e.message)
        })

        send({ type: 'RUN' })
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
        const exitCode = await exit
        currentProcess.current = null

        if (exitCode !== 0) {
          addMessage('error', [`Process exited with code ${exitCode}`])
        }
        send({ type: 'SUCCESS' })
      } catch (error) {
        onError(error as Error)
        send({ type: 'FAILURE', error: (error as Error).message })
      }
    },
    [tsCode, addMessage, isRunning, send]
  )

  return { compilerStatus, isRunning, runCode, stopCode }
}
