import { useState, useCallback } from 'react'
import type { ConsoleMessage } from '../lib/types'

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const [consoleOpen, setConsoleOpen] = useState(true)

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      const newMsg: ConsoleMessage = {
        id: Math.random().toString(36).slice(2, 9),
        type,
        args: args.map(String),
        ts: Date.now(),
      }
      setMessages((prev) => [...prev, newMsg].slice(-200))
    },
    []
  )

  const clearMessages = useCallback(() => setMessages([]), [])
  const toggleConsole = useCallback(() => setConsoleOpen((v) => !v), [])

  return {
    messages,
    addMessage,
    clearMessages,
    consoleOpen,
    toggleConsole,
  }
}
