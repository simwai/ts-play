import React, { useRef, useEffect, useMemo } from 'react';
import { Eraser } from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { PanelHeader } from './ui/PanelHeader';
import Ansi from 'ansi-to-html';

export type ConsoleMessage = {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'dir';
  args: string[];
  ts: number;
};

type Props = {
  messages: ConsoleMessage[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
  contentHeight: number;
  trueColorEnabled?: boolean;
};

function typeVariant(type: ConsoleMessage['type']): 'error' | 'warn' | 'info' | 'default' {
  if (type === 'error') return 'error';
  if (type === 'warn' || type === 'trace') return 'warn';
  if (type === 'info' || type === 'debug' || type === 'dir') return 'info';
  return 'default';
}

function typeLabel(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'ERR';
  if (type === 'warn') return 'WRN';
  if (type === 'info') return 'INF';
  if (type === 'debug') return 'DBG';
  if (type === 'trace') return 'TRC';
  if (type === 'dir') return 'DIR';
  return 'LOG';
}

function typeColorClass(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'text-red';
  if (type === 'warn' || type === 'trace') return 'text-yellow';
  if (type === 'info' || type === 'debug' || type === 'dir') return 'text-blue';
  return 'text-text';
}

// Improved ANSI colors to prevent "weird" splits and use better contrast
const ANSI_COLORS = {
  0: '#000000',
  1: '#CD0000', // Red
  2: '#00CD00', // Green
  3: '#CDCD00', // Yellow
  4: '#0000EE', // Blue
  5: '#CD00CD', // Magenta
  6: '#00CDCD', // Cyan
  7: '#E5E5E5', // Gray
  8: '#7F7F7F', // Dark Gray
  9: '#FF0000', // Bright Red
  10: '#00FF00', // Bright Green
  11: '#FFFF00', // Bright Yellow
  12: '#5C5CFF', // Bright Blue
  13: '#FF00FF', // Bright Magenta
  14: '#00FFFF', // Bright Cyan
  15: '#FFFFFF', // White
};

export const Console = React.memo(function Console({
  messages,
  onClear,
  isOpen,
  onToggle,
  contentHeight,
  trueColorEnabled = true,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const ansiConvert = useMemo(
    () =>
      new Ansi({
        newline: false,
        escapeHtml: true,
        stream: false,
        colors: ANSI_COLORS,
      }),
    [],
  );

  useEffect(() => {
    if (isOpen) {
       requestAnimationFrame(() => {
         bottomRef.current?.scrollIntoView({ behavior: 'auto' });
       });
    }
  }, [messages.length, isOpen]);

  const stats = useMemo(() => {
     let err = 0, wrn = 0;
     for (const m of messages) {
       if (m.type === 'error') err++;
       if (m.type === 'warn') wrn++;
     }
     return { err, wrn };
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-mantle shrink-0" data-testid="console-container">
      <PanelHeader
        label="Console"
        isOpen={isOpen}
        onToggle={onToggle}
        left={
          <>
            {messages.length > 0 && <Badge label={String(messages.length)} />}
            {stats.err > 0 && <Badge label={`${stats.err} err`} variant="error" />}
            {stats.wrn > 0 && <Badge label={`${stats.wrn} warn`} variant="warn" />}
          </>
        }
        right={
          messages.length > 0 ? (
            <Button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              variant="secondary"
              size="xs"
              title="Clear console"
              data-testid="console-clear-button"
            >
              <Eraser size={12} />
              Clear
            </Button>
          ) : undefined
        }
      />

      {isOpen && (
        <div className="overflow-y-auto overflow-x-hidden border-t border-surface0 flex-1" style={{ height: `${contentHeight}rem` }}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono">
              No output yet — press Run to execute
            </div>
          ) : (
            messages.map((m, idx) => {
              if (!m || !m.args) return null;
              const fullText = m.args.join(' ');
              const hasAnsi = trueColorEnabled && /[\u001b\u009b]/.test(fullText);

              return (
                <div key={`${m.ts}-${idx}`} data-testid="console-line" className={`flex items-start gap-3 px-4 py-1.5 border-b border-surface0/20 ${m.type === 'error' ? 'bg-red/5' : m.type === 'warn' ? 'bg-yellow/5' : ''}`}>
                  <Badge label={typeLabel(m.type)} variant={typeVariant(m.type)} className="mt-0.5" />
                  {hasAnsi ? (
                    <div className="m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono" dangerouslySetInnerHTML={{ __html: ansiConvert.toHtml(fullText) }} />
                  ) : (
                    <pre className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(m.type)}`}>{fullText}</pre>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} className="h-4 w-full" />
        </div>
      )}
    </div>
  );
});
