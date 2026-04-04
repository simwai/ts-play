import { useCallback, useEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { useSetAtom } from 'jotai'
import { compilerMachine } from '../lib/machines/compilerMachine'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand, readFile } from '../lib/webcontainer'
import { compilerStatusAtom, isRunningAtom, enqueueTaskAtom } from '../lib/store'
import type { CompilerStatus } from '../lib/types'
import type { ConsoleMessage } from '../components/Console'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [state, send] = useMachine(compilerMachine)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setStatus = useSetAtom(compilerStatusAtom)
  const setIsRunning = useSetAtom(isRunningAtom)
  const enqueueTask = useSetAtom(enqueueTaskAtom)

  useEffect(() => {
    const status: CompilerStatus = state.matches('initializing')
      ? 'loading'
      : state.matches('compiling')
      ? 'compiling'
      : state.matches('running')
      ? 'running'
      : state.matches('error')
      ? 'error'
      : 'ready'

    setStatus(status)
    setIsRunning(state.matches('running'))
  }, [state, setStatus, setIsRunning])

  useEffect(() => {
    send({ type: 'BOOT_START' })
    workerClient
      .init()
      .then((res) => res.match(
        () => {
          send({ type: 'BOOT_SUCCESS' })
          loadPrettier().catch(() => {})
        },
        (err) => {
          console.error('Worker init failed:', err)
          send({ type: 'BOOT_FAILURE', error: err.message })
        }
      ))
  }, [send])

  const stopCode = useCallback(() => {
    send({ type: 'STOP' })
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    addMessage('info', ['Execution stopped.'])
  }, [send, addMessage])

  const runCode = useCallback(
    async (
      pendingInstalls: Promise<void>,
      onSuccess: (js: string, dts: string) => void,
      onError: (error: Error) => void
    ) => {
      if (state.matches('running') || state.matches('compiling')) return

      return enqueueTask({
        name: 'Run Code',
        task: async () => {
          send({ type: 'COMPILE_START' })

          try {
            await Promise.race([
              pendingInstalls,
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error('Background tasks timed out')),
                  30000
                )
              ),
            ]).catch((e) => {
              console.warn('Proceeding despite background task warning:', e.message)
            })

            const writeRes = await writeFiles({
              'main.ts': tsCode,
            })
            if (writeRes.isErr()) throw writeRes.error

            addMessage('info', ['Compiling with esbuild...'])

            const esbuildProcResult = await runCommand('npx', [
              'esbuild',
              'main.ts',
              '--bundle',
              '--platform=node',
              '--outfile=index.js',
              '--format=esm',
              '--target=es2020'
            ], (out) => {
               const clean = out.trim()
               if (clean) addMessage('info', [clean])
            })

            if (esbuildProcResult.isErr()) throw esbuildProcResult.error
            const esbuildProc = esbuildProcResult.value
            const esbuildExitCode = await esbuildProc.exit

            if (esbuildExitCode !== 0) {
               throw new Error(`Compilation failed with code ${esbuildExitCode}`)
            }

            const jsResult = await readFile('index.js')
            const js = jsResult.isOk() ? jsResult.value : ''

            const dtsResult = await workerClient.generateDts(tsCode)
            const dts = dtsResult.isOk() ? dtsResult.value : ''

            onSuccess(js, dts)

            addMessage('info', ['Executing via Node.js...'])
            const processResult = await runCommand('node', ['index.js'], (out) => {
              const clean = out.trim()
              if (clean) addMessage('log', [clean])
            })

            if (processResult.isErr()) throw processResult.error
            const process = processResult.value
            send({ type: 'COMPILE_SUCCESS', process })

            timeoutRef.current = setTimeout(() => {
              send({ type: 'STOP' })
              addMessage('error', ['Execution timed out after 5 minutes.'])
            }, 300000)

            const exitCode = await process.exit

            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }

            if (exitCode !== 0 && !state.matches('idle')) {
               addMessage('error', [`Process exited with code ${exitCode}`])
            }

            send({ type: 'PROCESS_DONE' })
          } catch (error) {
            const message = (error as Error).message
            send({ type: 'COMPILE_FAILURE', error: message })
            onError(error as Error)
            throw error
          }
        }
      })
    },
    [tsCode, addMessage, send, state, enqueueTask]
  )

  return {
    runCode,
    stopCode,
  }
}
