import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { ThemeMode } from './theme'
import type { CompilerStatus, PackageManagerStatus, ToastMessage, ToastType } from './types'
import { DEFAULT_TS, DEFAULT_TSCONFIG } from './constants'

// Persistent State
export const tsCodeAtom = atomWithStorage('tsplay_ts', DEFAULT_TS)
export const jsCodeAtom = atomWithStorage('tsplay_js', '// Press Run to compile TypeScript →')
export const dtsCodeAtom = atomWithStorage('tsplay_dts', '// Declaration files will appear here')
export const tsConfigAtom = atomWithStorage('tsplay_tsconfig', DEFAULT_TSCONFIG)
export const isDarkModeAtom = atomWithStorage('tsplay_is_dark', true)
export const preferredDarkThemeAtom = atomWithStorage<ThemeMode>('tsplay_dark_theme', 'mocha')
export const preferredLightThemeAtom = atomWithStorage<ThemeMode>('tsplay_light_theme', 'latte')
export const trueColorEnabledAtom = atomWithStorage('tsplay_true_color', true)
export const lineWrapAtom = atomWithStorage('tsplay_line_wrap', false)
export const showNodeWarningsAtom = atomWithStorage('tsplay_show_node_warnings', false)

// Operational State (Memory-only)
export const compilerStatusAtom = atom<CompilerStatus>('loading')
export const packageManagerStatusAtom = atom<PackageManagerStatus>('idle')
export const isRunningAtom = atom(false)
export const toastsAtom = atom<ToastMessage[]>([])
export const jsDirtyAtom = atom(false)

// Actions (Write-only atoms)
export const addToastAtom = atom(
  null,
  (get, set, { type, message }: { type: ToastType, message: string }) => {
    const id = Math.random().toString(36).slice(2, 11)
    const newToast = { id, type, message }
    set(toastsAtom, (prev) => [...prev, newToast])
    return id
  }
)

export const removeToastAtom = atom(
  null,
  (get, set, id: string) => {
    set(toastsAtom, (prev) => prev.filter((t) => t.id !== id))
  }
)

// Task Queue (Sequential execution)
let queuePromise = Promise.resolve()
export const enqueueTaskAtom = atom(
  null,
  async (get, set, { name, task }: { name: string, task: () => Promise<any> }) => {
    const addToast = (type: ToastType, message: string) => {
        const id = Math.random().toString(36).slice(2, 11)
        set(toastsAtom, (prev) => [...prev, { id, type, message }])
        return id
    }

    const toastId = addToast('info', `Action queued: ${name}`)

    const currentQueue = queuePromise
    const newPromise = currentQueue.then(async () => {
      try {
        return await task()
      } finally {
        set(toastsAtom, (prev) => prev.filter((t) => t.id !== toastId))
      }
    }).catch((err) => {
      console.error(`Task "${name}" failed:`, err)
      addToast('error', `Task failed: ${name}`)
    })

    queuePromise = newPromise.then(() => {})
    return newPromise
  }
)

// Global Reset Action
export const resetWorkspaceAtom = atom(
  null,
  (get, set) => {
    set(tsCodeAtom, DEFAULT_TS)
    set(jsCodeAtom, '// Press Run to compile TypeScript →')
    set(dtsCodeAtom, '// Declaration files will appear here')
    set(tsConfigAtom, DEFAULT_TSCONFIG)
    set(jsDirtyAtom, false)
    set(toastsAtom, [])
    // Note: Theme and other settings are preserved
  }
)
