import { useState, useCallback, useEffect } from 'react'
import type { ConsoleMessage } from '../components/Console'

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const [consoleOpen, setConsoleOpen] = useState(true)

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      if (
        type === 'error' &&
        args.some(
          (a) =>
            typeof a === 'string' && a.includes('Maximum update depth exceeded')
        )
      ) {
        return
      }

      const formatted = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a, null, 2)
        } catch {
          return String(a)
        }
      })
      setMessages((previous) =>
        [...previous, { type, args: formatted, ts: Date.now() }].slice(-500)
      )
    },
    []
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    setConsoleOpen((o) => !o)
  }, [])

  useEffect(() => {
    const origLog = console.log
    const origError = console.error
    const origWarn = console.warn
    const origInfo = console.info
    const origDebug = console.debug
    const origTrace = console.trace
    const origDir = console.dir

    console.log = (...a) => {
      addMessage('log', a)
      origLog(...a)
    }

    console.error = (...a) => {
      addMessage('error', a)
      origError(...a)
    }

    console.warn = (...a) => {
      addMessage('warn', a)
      origWarn(...a)
    }

    console.info = (...a) => {
      addMessage('info', a)
      origInfo(...a)
    }

    console.debug = (...a) => {
      addMessage('debug', a)
      origDebug(...a)
    }

    console.trace = (...a) => {
      addMessage('trace', a)
      origTrace(...a)
    }

    console.dir = (...a) => {
      addMessage('dir', a)
      origDir(...a)
    }

    return () => {
      console.log = origLog
      console.error = origError
      console.warn = origWarn
      console.info = origInfo
      console.debug = origDebug
      console.trace = origTrace
      console.dir = origDir
    }
  }, [addMessage])

  return { messages, addMessage, clearMessages, consoleOpen, toggleConsole }
}
