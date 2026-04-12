export type TSDiagnostic = {
  start: number
  length: number
  message: string
  category: 'error' | 'warning'
  line: number
  character: number
}

export type TypeInfo = {
  name: string
  kind: string
  typeAnnotation: string
  signature?: string
  jsDoc?: string
  detail?: string
}

export type ConsoleMessageType =
  | 'log'
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  | 'trace'
  | 'dir'
  | 'system'

export type ConsoleMessage = {
  id: string
  type: ConsoleMessageType
  ts: number
  args: string[]
}

export type CompilerStatus =
  | 'loading'
  | 'preparing'
  | 'compiling'
  | 'running'
  | 'ready'
  | 'error'

export type PackageManagerStatus =
  | 'idle'
  | 'installing'
  | 'uninstalling'
  | 'syncing'
  | 'error'

export type ToastType = 'success' | 'info' | 'error' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

export type TabType = 'ts' | 'js' | 'dts'


export interface InstalledPackage {
  name: string
  version: string
  types?: string
}

export interface PlaygroundConfig {
  theme: string
  themeMode: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  showLineNumbers: boolean
  minimap: boolean
}
