import { createMachine, assign } from 'xstate'

export type PackageContext = {
  error: string | null
}

export type PackageEvent =
  | { type: 'INSTALL' }
  | { type: 'UNINSTALL' }
  | { type: 'SYNC' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; error: string }

export const packageMachine = createMachine(
  {
    id: 'package',
    initial: 'idle',
    types: {} as {
      context: PackageContext
      events: PackageEvent
    },
    context: {
      error: null,
    },
    states: {
      idle: {
        on: {
          INSTALL: 'installing',
          UNINSTALL: 'uninstalling',
          SYNC: 'syncing',
        },
      },
      installing: {
        on: {
          SUCCESS: 'idle',
          FAILURE: {
            target: 'error',
            actions: 'setError',
          },
        },
      },
      uninstalling: {
        on: {
          SUCCESS: 'idle',
          FAILURE: {
            target: 'error',
            actions: 'setError',
          },
        },
      },
      syncing: {
        on: {
          SUCCESS: 'idle',
          FAILURE: {
            target: 'error',
            actions: 'setError',
          },
        },
      },
      error: {
        on: {
          INSTALL: 'installing',
          UNINSTALL: 'uninstalling',
          SYNC: 'syncing',
        },
      },
    },
  },
  {
    actions: {
      setError: assign({
        error: ({ event }) => event.type === 'FAILURE' ? event.error : null
      }),
    },
  }
)
