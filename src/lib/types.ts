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

export type ConsoleMessageType = 'log' | 'info' | 'warn' | 'error'

export type ConsoleMessage = {
  id: string
  type: ConsoleMessageType
  timestamp: number
  args: any[]
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

export type ToastType = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}
