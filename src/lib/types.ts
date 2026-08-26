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
  typeAnnotation?: string
  type?: string
  signature?: string
  jsDoc?: string
  documentation?: string
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

export type CompilerStatus =
  | 'loading'
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

export type ToastType = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}
