import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConsoleMessage } from '../components/Console';
import { RegexPatterns, toRegExp } from '../lib/regex';

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const messagesRef = useRef<ConsoleMessage[]>([]);

  const addMessage = useCallback(
    (type: ConsoleMessage['type'], args: unknown[]) => {
      // Prevent recursion from our own logging
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

      // Sanitize and format args
      const formatted = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'string') {
           // Strip problematic characters but keep basic ANSI and layout
           // Strip large repeating whitespace but keep tabs/newlines
           return a.replace(toRegExp(RegexPatterns.EXCESSIVE_SPACES), (match) => '          ' + (match.length - 10) + ' spaces ');
        }
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      });

      try {
        const newMessage: ConsoleMessage = { type, args: formatted, ts: Date.now() };
        messagesRef.current = [...messagesRef.current, newMessage].slice(-200);
        setMessages([...messagesRef.current]);
      } catch (err) {
        // Fallback
        (window as any).__ORIG_CONSOLE__?.error('Failed to update messages:', err);
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  const toggleConsole = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setConsoleOpen((o) => !o);
  }, []);

  useEffect(() => {
    const win = window as any;
    const origLog = win.__ORIG_CONSOLE__?.log || console.log;
    const origError = win.__ORIG_CONSOLE__?.error || console.error;
    const origWarn = win.__ORIG_CONSOLE__?.warn || console.warn;
    const origInfo = win.__ORIG_CONSOLE__?.info || console.info;
    const origDebug = win.__ORIG_CONSOLE__?.debug || console.debug;
    const origTrace = win.__ORIG_CONSOLE__?.trace || console.trace;
    const origDir = win.__ORIG_CONSOLE__?.dir || console.dir;

    if (!win.__ORIG_CONSOLE__) {
      win.__ORIG_CONSOLE__ = {
        log: origLog,
        error: origError,
        warn: origWarn,
        info: origInfo,
        debug: origDebug,
        trace: origTrace,
        dir: origDir,
      };
    }

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
