import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'

import {
  createInitialState,
  ensureInitialized,
  LanguageServiceState,
} from './languageService'
import { handleMonacoMethod } from './monacoProtocol'
import { handleCustomMessage } from './customMessages'
import { toErrorMessage } from './errors'
import {
  type WorkerIncomingMessage,
  type CustomMessageRequest,
  type MonacoMethodRequest,
  isCustomMessageRequest,
  isMonacoMethodRequest,
} from './workerProtocol'

const state = createInitialState()

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const msg = messageEvent.data as WorkerIncomingMessage
  try {
    // Monaco method
    if (isMonacoMethodRequest(msg)) {
      const { id, method, args, fileName } = msg
      // For 'init', respond synchronously – no await
      if (method === 'init') {
        const result = await handleMonacoMethod(method, args, fileName, state)
        self.postMessage({ id, result })
        return
      }
      await ensureInitialized(state)
      const result = await handleMonacoMethod(method, args, fileName, state)
      self.postMessage({ id, result })
      return
    }
    // Custom message
    if (isCustomMessageRequest(msg)) {
      const { id, type, payload } = msg
      if (type === 'INIT') {
        await ensureInitialized(state)
        self.postMessage({ id, success: true, payload: true })
        return
      }
      await ensureInitialized(state)
      const result = await handleCustomMessage(type, payload, state)
      self.postMessage({ id, success: true, payload: result })
      return
    }
  } catch (error) {
    const message = toErrorMessage(error)
    if ('method' in msg) {
      self.postMessage({ id: msg.id, error: message })
    } else {
      self.postMessage({ id: msg.id, success: false, error: message })
    }
  }
}
