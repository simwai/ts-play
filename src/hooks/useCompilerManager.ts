import { useCallback, useEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { compilerMachine } from '../lib/machines/compilerMachine'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand, readFile } from '../lib/webcontainer'
import type { CompilerStatus } from '../lib/types'
import type { ConsoleMessage } from '../components/Console'

export function useCompilerManager(
  tsCode: string,
  addMessage: (type: ConsoleMessage['type'], args: unknown[]) => void
) {
  const [state, send] = useMachine(compilerMachine)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      send({ type: 'COMPILE_START' })

      try {
        // Wait for background tasks (like npm install esbuild) if any
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

        // Write source code
        const writeRes = await writeFiles({
          'main.ts': tsCode,
        })
        if (writeRes.isErr()) throw writeRes.error

        addMessage('info', ['Compiling with esbuild...'])

        // Run esbuild in the container
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

        // Read back the compiled JS for the UI
        const jsResult = await readFile('index.js')
        const js = jsResult.isOk() ? jsResult.value : ''

        // Get .d.ts from worker (it uses Language Service)
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
      }
    },
    [tsCode, addMessage, send, state]
  )

  const compilerStatus: CompilerStatus = state.matches('initializing')
    ? 'loading'
    : state.matches('compiling')
    ? 'compiling'
    : state.matches('running')
    ? 'running'
    : state.matches('error')
    ? 'error'
    : 'ready'

  return {
    compilerStatus,
    isRunning: state.matches('running'),
    runCode,
    stopCode,
  }
}
