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
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
        },
      },
      uninstalling: {
        on: {
          SUCCESS: 'idle',
          FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
          },
        },
      },
      syncing: {
        on: {
          SUCCESS: 'idle',
          FAILURE: {
            target: 'error',
            actions: assign({ error: ({ event }) => (event as any).error }),
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
  }
)
