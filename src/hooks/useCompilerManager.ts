import { useState, useEffect, useCallback, useRef } from 'react'
import { workerClient } from '../lib/workerClient'
import { loadPrettier } from '../lib/formatter'
import { writeFiles, runCommand, getWebContainer } from '../lib/webcontainer'
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

        // Wait for potential installations (like esbuild) before starting
        const installTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Initial package installation timed out')),
            30000
          )
        )

        addMessage('info', ['Syncing files and preparing for compilation...'])
        const wc = await getWebContainer()
        await wc.fs.writeFile('index.ts', codeToCompile)
        try { await wc.fs.rm('index.js'); } catch {}
        await Promise.race([pendingInstalls, installTimeout]).catch((e) => {
          console.warn('Proceeding with potentially missing packages:', e.message)
        })

        addMessage('info', ['Compiling via esbuild in WebContainer...'])
        // Use node_modules/.bin/esbuild directly if possible, or npx as fallback
        const compileResult = await runCommand(
          './node_modules/.bin/esbuild',
          [
            'index.ts',
            '--bundle',
            '--platform=node',
            '--format=esm',
            '--outfile=index.js',
            '--packages=external',
            '--log-level=error'
          ],
          (out) => {
            if (out.trim()) addMessage('error', [out.trim()])
          }
        ).catch(async () => {
          return await runCommand(
            'npx',
            [
              'esbuild',
              'index.ts',
              '--bundle',
              '--platform=node',
              '--format=esm',
              '--outfile=index.js',
              '--packages=external',
              '--log-level=error'
            ],
            (out) => {
              if (out.trim()) addMessage('error', [out.trim()])
            }
          )
        })

        const compileExitCode = await compileResult.exit
        if (compileExitCode !== 0) {
          throw new Error(`Compilation failed with exit code ${compileExitCode}`)
        }

        // Read compiled JS back for the UI
        const compiledJs = await wc.fs.readFile('index.js', 'utf8').catch(() => '// Error reading compiled file')

        // Use worker for d.ts generation as esbuild-wasm doesn't do it easily
        const { dts } = await workerClient.compile(codeToCompile)
        onSuccess(compiledJs, dts)

        addMessage('info', ['Executing via Node.js...'])
        const { exit, process } = await runCommand(
          'node',
          ['index.js'],
          (out) => {
            if (out && typeof out === 'string') {
              const lines = out.split('\n');
              lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed) addMessage('log', [trimmed]);
              });
            }
          }
        )

        currentProcess.current = process

        timeoutRef.current = setTimeout(() => {
          if (currentProcess.current) {
            currentProcess.current.kill()
            currentProcess.current = null
          }
          addMessage('error', ['Execution timed out after 5 minutes.'])
          setIsRunning(false)
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
