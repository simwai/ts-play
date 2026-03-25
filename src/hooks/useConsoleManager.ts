import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConsoleMessage } from '../components/Console';

export function useConsoleManager() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const messagesRef = useRef<ConsoleMessage[]>([]);
  const isInternalProcessing = useRef(false);

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
           // Strip large repeating whitespace but keep tabs/newlines
           return a.replace(/ {10,}/g, (match) => '          ' + (match.length - 10) + ' spaces ');
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
        const win = window as any;
        if (win.__ORIG_CONSOLE__?.error) {
           win.__ORIG_CONSOLE__.error('Failed to update messages:', err);
        }
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

    const patch = (type: ConsoleMessage['type'], orig: (...args: any[]) => void) => {
       return (...args: any[]) => {
          if (!isInternalProcessing.current) {
             isInternalProcessing.current = true;
             addMessage(type, args);
             isInternalProcessing.current = false;
          }
          orig(...args);
       };
    };

    console.log = patch('log', origLog);
    console.error = patch('error', origError);
    console.warn = patch('warn', origWarn);
    console.info = patch('info', origInfo);
    console.debug = patch('debug', origDebug);
    console.trace = patch('trace', origTrace);
    console.dir = patch('dir', origDir);

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
