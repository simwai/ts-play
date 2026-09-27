// Worker Protocol Types
// Shared between worker.ts, workerClient.ts, and monacoProtocol.ts
// Provides type-safe message passing via discriminated unions.

// ── Custom Message Types ────────────────────────────────────────────

export interface UpdateFilePayload {
  type: 'UPDATE_FILE'
  content?: string
  filename?: string
}

export interface UpdateExtraLibsPayload {
  type: 'UPDATE_EXTRA_LIBS'
  libs?: Record<string, string>
}

export interface UpdateConfigPayload {
  type: 'UPDATE_CONFIG'
  tsconfig?: string
}

export interface ValidateConfigPayload {
  type: 'VALIDATE_CONFIG'
  tsconfig?: string
}

export interface CompilePayload {
  type: 'COMPILE'
  code?: string
}

export interface DetectImportsPayload {
  type: 'DETECT_IMPORTS'
  code?: string
}

export type CustomMessageType =
  | 'INIT'
  | 'UPDATE_FILE'
  | 'UPDATE_EXTRA_LIBS'
  | 'UPDATE_CONFIG'
  | 'VALIDATE_CONFIG'
  | 'COMPILE'
  | 'DETECT_IMPORTS'

export type CustomMessagePayload =
  | UpdateFilePayload
  | UpdateExtraLibsPayload
  | UpdateConfigPayload
  | ValidateConfigPayload
  | CompilePayload
  | DetectImportsPayload

export interface CustomMessageRequest {
  id: number
  type: CustomMessageType
  payload?: CustomMessagePayload
}

export interface CustomMessageResponse<T = unknown> {
  id: number
  success: boolean
  payload?: T
  error?: string
}

// ── Monaco Method Types ────────────────────────────────────────────

export type MonacoMethodName =
  | 'init'
  | 'getDefaultLibFileName'
  | 'getScriptFileNames'
  | 'getScriptVersion'
  | 'getScriptSnapshot'
  | 'getDiagnostics'
  | 'getCompletionsAtPosition'
  | 'getQuickInfoAtPosition'
  | 'getEmitOutput'

export interface MonacoMethodArgs {
  init: []
  getDefaultLibFileName: []
  getScriptFileNames: []
  getScriptVersion: [fileName: string]
  getScriptSnapshot: [fileName: string]
  getDiagnostics: []
  getCompletionsAtPosition: [position: number]
  getQuickInfoAtPosition: [position: number]
  getEmitOutput: []
}

export interface MonacoMethodRequest {
  id: number
  method: MonacoMethodName
  args: MonacoMethodArgs[MonacoMethodName]
  fileName?: string
}

export interface MonacoMethodResponse<T = unknown> {
  id: number
  result?: T
  error?: string
}

// ── Union of all incoming messages ────────────────────────────────

export type WorkerIncomingMessage = CustomMessageRequest | MonacoMethodRequest

export type WorkerOutgoingMessage = CustomMessageResponse | MonacoMethodResponse

// ── Type Guards ────────────────────────────────────────────────────

export function isCustomMessageRequest(
  msg: WorkerIncomingMessage
): msg is CustomMessageRequest {
  return 'type' in msg
}

export function isMonacoMethodRequest(
  msg: WorkerIncomingMessage
): msg is MonacoMethodRequest {
  return 'method' in msg
}
