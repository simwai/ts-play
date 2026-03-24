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
  contentHeight: number; // In rem
  trueColorEnabled?: boolean;
};

function typeVariant(
  type: ConsoleMessage['type'],
): 'error' | 'warn' | 'info' | 'default' {
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
        colors: trueColorEnabled
      }),
    [trueColorEnabled],
  );

  useEffect(() => {
    if (isOpen) {
       requestAnimationFrame(() => {
         bottomRef.current?.scrollIntoView({ behavior: 'auto' });
       });
    }
  }, [messages.length, isOpen]);

  const errors = useMemo(() => (messages || []).filter((m) => m && m.type === 'error').length, [messages]);
  const warns = useMemo(() => (messages || []).filter((m) => m && m.type === 'warn').length, [messages]);

  return (
    <div
      className="flex flex-col h-full bg-mantle shrink-0"
      data-testid="console-container"
    >
      <PanelHeader
        label="Console"
        isOpen={isOpen}
        onToggle={onToggle}
        left={
          <>
            {(messages || []).length > 0 && (
              <Badge label={String((messages || []).length)} />
            )}
            {errors > 0 && <Badge label={`${errors} err`} variant="error" />}
            {warns > 0 && <Badge label={`${warns} warn`} variant="warn" />}
          </>
        }
        right={
          (messages || []).length > 0 ? (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              variant="secondary"
              size="xs"
              title="Clear console"
              data-testid="console-clear-button"
              tooltipAlign="right"
            >
              <Eraser size={12} />
              Clear
            </Button>
          ) : undefined
        }
      />

      {isOpen && (
        <div
          className="overflow-y-auto overflow-x-hidden border-t border-surface0 flex-1"
          style={{ height: `${contentHeight}rem` }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-overlay0 text-xxs md:text-xs italic font-mono">
              No output yet — press Run to execute
            </div>
          ) : (
            (messages || []).map((m, idx) => {
              if (!m || !m.args) return null;
              const fullText = Array.isArray(m.args)
                ? m.args.join(' ')
                : String(m.args);

              const hasAnsi = trueColorEnabled && /[\u001b\u009b]/.test(fullText);

              let content: React.ReactNode;
              if (hasAnsi) {
                try {
                  const converted = ansiConvert.toHtml(fullText);
                  content = (
                    <div
                      className="m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono"
                      dangerouslySetInnerHTML={{
                        __html: converted || '',
                      }}
                    />
                  );
                } catch (err) {
                  // Fallback for malformed ANSI - render raw but in red
                  content = (
                    <pre className="m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono text-red opacity-80">
                      {fullText}
                    </pre>
                  );
                }
              } else {
                content = (
                  <pre
                    className={`m-0 p-0 text-xxs md:text-xs leading-relaxed whitespace-pre-wrap wrap-break-word flex-1 font-mono ${typeColorClass(m.type)}`}
                  >
                    {fullText}
                  </pre>
                );
              }

              return (
                <div
                  key={`${m.ts}-${idx}`}
                  data-testid="console-message"
                  className={`flex items-start gap-3 px-4 py-1.5 border-b border-surface0/20 ${
                    m.type === 'error'
                      ? 'bg-red/5'
                      : m.type === 'warn'
                        ? 'bg-yellow/5'
                        : 'bg-transparent'
                  }`}
                >
                  <Badge
                    label={typeLabel(m.type)}
                    variant={typeVariant(m.type)}
                    className="mt-0.5"
                  />
                  {content}
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
