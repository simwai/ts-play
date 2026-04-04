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
    id: 'packageManager',
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
          FAILURE: 'error',
        },
      },
      uninstalling: {
        on: {
          SUCCESS: 'idle',
          FAILURE: 'error',
        },
      },
      syncing: {
        on: {
          SUCCESS: 'idle',
          FAILURE: 'error',
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
      setError: assign({ error: ({ event }) => (event as any).error }),
    },
  }
)
