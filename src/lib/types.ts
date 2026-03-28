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

type ConsoleMessageType = 'log' | 'info' | 'warn' | 'error'

type ConsoleMessage = {
  id: string
  type: ConsoleMessageType
  timestamp: number
  args: any[]
}

export type CompilerStatus = 'loading' | 'ready' | 'error' | 'compiling' | 'running'
export type PackageManagerStatus = 'idle' | 'installing' | 'syncing' | 'error'

export type ToastType = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}
