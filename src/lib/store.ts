import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { ThemeMode } from './theme'
import type {
  CompilerStatus,
  PackageManagerStatus,
  ToastMessage,
  ToastType,
} from './types'
import { DEFAULT_TS, DEFAULT_TSCONFIG } from './constants'

export const tsCodeAtom = atomWithStorage('tsplay_ts', DEFAULT_TS)
export const jsCodeAtom = atomWithStorage(
  'tsplay_js',
  '// Press Run to compile TypeScript →'
)
export const dtsCodeAtom = atomWithStorage(
  'tsplay_dts',
  '// Declaration files will appear here'
)
export const tsConfigAtom = atomWithStorage('tsplay_tsconfig', DEFAULT_TSCONFIG)
export const isDarkModeAtom = atomWithStorage('tsplay_is_dark', true)
export const preferredDarkThemeAtom = atomWithStorage<ThemeMode>(
  'tsplay_dark_theme',
  'mocha' as any
)
export const preferredLightThemeAtom = atomWithStorage<ThemeMode>(
  'tsplay_light_theme',
  'latte' as any
)
export const trueColorEnabledAtom = atomWithStorage('tsplay_true_color', true)
export const lineWrapAtom = atomWithStorage('tsplay_line_wrap', false)
export const showNodeWarningsAtom = atomWithStorage(
  'tsplay_show_node_warnings',
  false
)
export const autoImportsAtom = atomWithStorage('tsplay_auto_imports', false)
export const customAutocompleteAtom = atomWithStorage(
  'tsplay_custom_autocomplete',
  false
)

export const compilerStatusAtom = atom<CompilerStatus>('loading')
export const packageManagerStatusAtom = atom<PackageManagerStatus>('idle')
export const isRunningAtom = atom(false)
export const toastsAtom = atom<ToastMessage[]>([])
export const jsDirtyAtom = atom(false)

export const addToastAtom = atom(
  null,
  (_get, set, { type, message }: { type: ToastType; message: string }) => {
    const id = Math.random().toString(36).slice(2, 11)
    set(toastsAtom, (prev) => [...prev, { id, type, message }])
    return id
  }
)

export const removeToastAtom = atom(null, (_get, set, id: string) => {
  set(toastsAtom, (prev) => prev.filter((t) => t.id !== id))
})

let queuePromise = Promise.resolve()
export const enqueueTaskAtom = atom(
  null,
  async (
    _get,
    set,
    { name, task }: { name: string; task: () => Promise<any> }
  ) => {
    const id = Math.random().toString(36).slice(2, 11)
    const toastId = id
    set(toastsAtom, (prev) => [
      ...prev,
      { id, type: 'info' as ToastType, message: `Action queued: ${name}` },
    ])

    const currentQueue = queuePromise
    const newPromise = currentQueue
      .then(async () => {
        try {
          return await task()
        } finally {
          set(toastsAtom, (prev) => prev.filter((t) => t.id !== toastId))
        }
      })
      .catch((err) => {
        console.error(`Task "${name}" failed:`, err)
        const failId = Math.random().toString(36).slice(2, 11)
        set(toastsAtom, (prev) => [
          ...prev,
          {
            id: failId,
            type: 'error' as ToastType,
            message: `Task failed: ${name}`,
          },
        ])
      })
    queuePromise = newPromise.then(() => {})
    return newPromise
  }
)

export const resetWorkspaceAtom = atom(null, (_get, set) => {
  set(tsCodeAtom, DEFAULT_TS)
  set(jsCodeAtom, '')
  set(dtsCodeAtom, '')
  set(tsConfigAtom, DEFAULT_TSCONFIG)
  set(jsDirtyAtom, false)
  set(toastsAtom, [])
})
