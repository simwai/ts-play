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
        let result = ''
        if (a instanceof Error) {
          result = a.stack || a.message
        } else if (typeof a === 'string') {
          result = a
        } else if (a && typeof a === 'object') {
          try {
            result = JSON.stringify(a, null, 2)
          } catch {
            result = String(a)
          }
        } else {
            result = String(a)
        }

        if (result.length > 5000) {
          result = result.slice(0, 5000) + '... (truncated)'
        }

        return result.replace(/ {10,}/g, '          ')
      })

      setMessages((previous) => {
        const id = Math.random().toString(36).slice(2, 11) + '-' + Date.now()
        const next = [...previous, { id, type, args: formatted, timestamp: Date.now() }]
        if (next.length > 200) {
          return next.slice(-200)
        }
        return next
      })
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
