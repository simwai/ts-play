import { createMachine, assign } from 'xstate'

export type CompilerContext = {
  error: string | null
}

export type CompilerEvent =
  | { type: 'BOOT_START' }
  | { type: 'BOOT_SUCCESS' }
  | { type: 'BOOT_FAILURE'; error: string }
  | { type: 'START' }
  | { type: 'RUN' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; error: string }
  | { type: 'STOP' }

export const compilerMachine = createMachine(
  {
    id: 'compiler',
    initial: 'initializing',
    types: {} as {
      context: CompilerContext
      events: CompilerEvent
    },
    context: {
      error: null,
    },
    states: {
      initializing: {
        on: {
          BOOT_SUCCESS: 'idle',
          BOOT_FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
        },
      },
      idle: {
        on: {
          START: 'compiling',
        },
      },
      compiling: {
        on: {
          RUN: 'running',
          FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
          STOP: 'idle',
        },
      },
      running: {
        on: {
          SUCCESS: 'idle',
          STOP: 'idle',
          FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
        },
      },
      error: {
        on: {
          START: 'compiling',
          BOOT_START: 'initializing',
        },
      },
    },
  }
)
