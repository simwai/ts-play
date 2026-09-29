import { useState, useCallback, useEffect } from 'react'
import type { ConsoleMessage } from '../components/Console'

const MAX_CONSOLE_MESSAGES = 500

function formatConsoleArg(arg: unknown): string {
  const isErrorInstance = arg instanceof Error
  if (isErrorInstance) return arg.stack || arg.message

  const isString = typeof arg === 'string'
  if (isString) return arg

  try {
    return JSON.stringify(arg, null, 2)
  } catch {
    return String(arg)
  }
}

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const [consoleOpen, setConsoleOpen] = useState(true)

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      const safeArgs = args || []
      const formattedArgs = safeArgs.map(formatConsoleArg)
      const newMessage: ConsoleMessage = {
        type,
        args: formattedArgs,
        ts: Date.now(),
      }

      setMessages((prev) =>
        [...prev, newMessage].slice(-MAX_CONSOLE_MESSAGES)
      )
    },
    []
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const toggleConsole = useCallback(() => {
    setConsoleOpen((isOpen) => !isOpen)
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
