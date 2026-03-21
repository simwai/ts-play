import { useState, useCallback, useEffect } from 'react';
import type { ConsoleMessage } from '../components/Console';

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      if (
        type === 'error' &&
        args.some(
          (a) =>
            typeof a === 'string' &&
            a.includes('Maximum update depth exceeded'),
        )
      ) {
        return;
      }

      const formatted = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      });
      try {
        setMessages((previous) =>
          [...previous, { type, args: formatted, ts: Date.now() }].slice(-500),
        );
      } catch (err) {
        // Fallback for extreme cases
        origLog('Failed to update messages:', err);
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setConsoleOpen((o) => !o);
  }, []);

  useEffect(() => {
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    const origInfo = console.info;
    const origDebug = console.debug;
    const origTrace = console.trace;
    const origDir = console.dir;

    let isInternalProcessing = false;

    console.log = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('log', a);
        isInternalProcessing = false;
      }
      origLog(...a);
    };

    console.error = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('error', a);
        isInternalProcessing = false;
      }
      origError(...a);
    };

    console.warn = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('warn', a);
        isInternalProcessing = false;
      }
      origWarn(...a);
    };

    console.info = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('info', a);
        isInternalProcessing = false;
      }
      origInfo(...a);
    };

    console.debug = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('debug', a);
        isInternalProcessing = false;
      }
      origDebug(...a);
    };

    console.trace = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('trace', a);
        isInternalProcessing = false;
      }
      origTrace(...a);
    };

    console.dir = (...a) => {
      if (!isInternalProcessing) {
        isInternalProcessing = true;
        addMessage('dir', a);
        isInternalProcessing = false;
      }
      origDir(...a);
    };

    return () => {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
      console.info = origInfo;
      console.debug = origDebug;
      console.trace = origTrace;
      console.dir = origDir;
    };
  }, [addMessage]);

  return { messages, addMessage, clearMessages, consoleOpen, toggleConsole };
}
