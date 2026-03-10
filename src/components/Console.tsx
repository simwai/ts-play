import React, { useRef, useEffect } from 'react';
import { CatppuccinTheme } from '../lib/theme';
import { Badge } from './ui/Badge';
import { IconButton } from './ui/IconButton';
import { PanelHeader } from './ui/PanelHeader';
import { Eraser } from 'lucide-react';

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'dir';
  args: string[];
  ts: number;
}

interface Props {
  messages:      ConsoleMessage[];
  onClear:       () => void;
  theme:         CatppuccinTheme;
  isOpen:        boolean;
  onToggle:      () => void;
  contentHeight: number;
}

const FONT = "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

function typeVariant(type: ConsoleMessage['type']): 'error' | 'warn' | 'info' | 'default' {
  if (type === 'error') return 'error';
  if (type === 'warn' || type === 'trace')  return 'warn';
  if (type === 'info' || type === 'debug' || type === 'dir')  return 'info';
  return 'default';
}

function typeLabel(type: ConsoleMessage['type']): string {
  if (type === 'error') return 'ERR';
  if (type === 'warn')  return 'WRN';
  if (type === 'info')  return 'INF';
  if (type === 'debug') return 'DBG';
  if (type === 'trace') return 'TRC';
  if (type === 'dir')   return 'DIR';
  return 'LOG';
}

function typeColor(type: ConsoleMessage['type'], t: CatppuccinTheme): string {
  if (type === 'error') return t.red;
  if (type === 'warn' || type === 'trace')  return t.yellow;
  if (type === 'info' || type === 'debug' || type === 'dir')  return t.blue;
  return t.text;
}

export const Console = React.memo(function Console({ messages, onClear, theme: t, isOpen, onToggle, contentHeight }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const errors = messages.filter(m => m.type === 'error').length;
  const warns  = messages.filter(m => m.type === 'warn').length;

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      borderTop:     `1px solid ${t.surface0}`,
      background:    t.mantle,
      flexShrink:    0,
    }}>
      <PanelHeader
        label="Console"
        isOpen={isOpen}
        onToggle={onToggle}
        theme={t}
        left={
          <>
            {messages.length > 0 && (
              <Badge label={String(messages.length)} theme={t} />
            )}
            {errors > 0 && (
              <Badge label={`${errors} err`} variant="error" theme={t} />
            )}
            {warns > 0 && (
              <Badge label={`${warns} warn`} variant="warn" theme={t} />
            )}
          </>
        }
        right={
          messages.length > 0 ? (
            <IconButton
              onClick={e => { e.stopPropagation(); onClear(); }}
              theme={t}
              variant="ghost"
              size="sm"
              title="Clear console"
              style={{ fontSize: 11, padding: '2px 8px', border: `1px solid ${t.surface1}`, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Eraser size={12} />
              Clear
            </IconButton>
          ) : undefined
        }
      />

      {isOpen && (
        <div style={{
          height:    contentHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderTop: `1px solid ${t.surface0}`,
        }}>
          {messages.length === 0 ? (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              height:         '100%',
              color:          t.overlay0,
              fontSize:       12,
              fontFamily:     FONT,
              fontStyle:      'italic',
            }}>
              No output yet — press Run to execute
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={`${m.ts}-${idx}`}
                style={{
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          8,
                  padding:      '5px 12px',
                  borderBottom: `1px solid ${t.surface0}44`,
                  background:
                    m.type === 'error' ? `${t.red}0a` :
                    m.type === 'warn'  ? `${t.yellow}0a` :
                    'transparent',
                }}
              >
                <Badge
                  label={typeLabel(m.type)}
                  variant={typeVariant(m.type)}
                  theme={t}
                  style={{ marginTop: 2 }}
                />
                <pre style={{
                  margin:     0,
                  padding:    0,
                  fontFamily: FONT,
                  fontSize:   12,
                  lineHeight: '18px',
                  color:      typeColor(m.type, t),
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                  flex:       1,
                }}>
                  {m.args.join(' ')}
                </pre>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
});
