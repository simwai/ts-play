import { createMachine, assign } from 'xstate'
import type { WebContainerProcess } from '@webcontainer/api'

export type CompilerContext = {
  process: WebContainerProcess | null
  error: string | null
}

export type CompilerEvent =
  | { type: 'BOOT_START' }
  | { type: 'BOOT_SUCCESS' }
  | { type: 'BOOT_FAILURE'; error: string }
  | { type: 'COMPILE_START' }
  | { type: 'COMPILE_SUCCESS'; process: WebContainerProcess }
  | { type: 'COMPILE_FAILURE'; error: string }
  | { type: 'STOP' }
  | { type: 'PROCESS_DONE' }

export const compilerMachine = createMachine(
  {
    id: 'compiler',
    initial: 'idle',
    types: {} as {
      context: CompilerContext
      events: CompilerEvent
    },
    context: {
      process: null,
      error: null,
    },
    states: {
      idle: {
        on: {
          BOOT_START: 'initializing',
          COMPILE_START: 'compiling',
        },
      },
      initializing: {
        on: {
          BOOT_SUCCESS: 'idle',
          BOOT_FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
        },
      },
      compiling: {
        on: {
          COMPILE_SUCCESS: {
            target: 'running',
            actions: assign({ process: ({ event }) => (event as any).process }),
          },
          COMPILE_FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
          STOP: 'idle',
        },
      },
      running: {
        exit: ['cleanupProcess'],
        on: {
          STOP: 'idle',
          PROCESS_DONE: 'idle',
          COMPILE_START: 'compiling',
        },
      },
      error: {
        on: {
          COMPILE_START: 'compiling',
          BOOT_START: 'initializing',
        },
      },
    },
  },
  {
    actions: {
      cleanupProcess: ({ context }) => {
        if (context.process) {
          try {
            context.process.kill()
          } catch (err) {
            console.warn('Failed to kill process:', err)
          }
        }
      },
    },
  }
)
