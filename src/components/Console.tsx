import { useRef, useEffect } from 'react';
import { CatppuccinTheme } from '../lib/theme';

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  args: string[];
  ts: number;
}

interface Props {
  messages: ConsoleMessage[];
  onClear: () => void;
  theme: CatppuccinTheme;
  isOpen: boolean;
  onToggle: () => void;
  contentHeight: number; // Height of the body content when open
}

export function Console({ messages, onClear, theme: t, isOpen, onToggle, contentHeight }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const typeColor = (type: ConsoleMessage['type']) => {
    if (type === 'error') return t.red;
    if (type === 'warn')  return t.yellow;
    if (type === 'info')  return t.blue;
    return t.text;
  };

  const typeLabel = (type: ConsoleMessage['type']) => {
    if (type === 'error') return 'ERR';
    if (type === 'warn')  return 'WRN';
    if (type === 'info')  return 'INF';
    return 'LOG';
  };

  const errors = messages.filter(m => m.type === 'error').length;
  const warns  = messages.filter(m => m.type === 'warn').length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${t.surface0}`,
      background: t.mantle,
      flexShrink: 0,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          background: t.mantle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: t.subtext0,
          }}>
            Console
          </span>
          {messages.length > 0 && (
            <span style={{
              fontSize: 10,
              color: t.overlay1,
              background: t.surface0,
              borderRadius: 3,
              padding: '1px 5px',
            }}>
              {messages.length}
            </span>
          )}
          {errors > 0 && (
            <span style={{
              fontSize: 10,
              color: t.red,
              background: `${t.red}22`,
              border: `1px solid ${t.red}44`,
              borderRadius: 3,
              padding: '1px 5px',
            }}>
              {errors} err
            </span>
          )}
          {warns > 0 && (
            <span style={{
              fontSize: 10,
              color: t.yellow,
              background: `${t.yellow}22`,
              border: `1px solid ${t.yellow}44`,
              borderRadius: 3,
              padding: '1px 5px',
            }}>
              {warns} warn
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {messages.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onClear(); }}
              style={{
                background: 'none',
                border: `1px solid ${t.surface1}`,
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 10,
                color: t.overlay1,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Clear
            </button>
          )}
          <span style={{
            fontSize: 12,
            color: t.overlay1,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 200ms',
            display: 'inline-block',
          }}>▾</span>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div style={{
          height: contentHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderTop: `1px solid ${t.surface0}`,
        }}>
          {messages.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: t.overlay0,
              fontSize: 12,
              fontFamily: 'monospace',
              fontStyle: 'italic',
            }}>
              No output yet — press Run to execute
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 12px',
                  borderBottom: `1px solid ${t.surface0}44`,
                  background: m.type === 'error' ? `${t.red}0a` : m.type === 'warn' ? `${t.yellow}0a` : 'transparent',
                }}
              >
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: typeColor(m.type),
                  background: `${typeColor(m.type)}22`,
                  border: `1px solid ${typeColor(m.type)}44`,
                  borderRadius: 3,
                  padding: '1px 4px',
                  flexShrink: 0,
                  marginTop: 1,
                  fontFamily: 'monospace',
                }}>
                  {typeLabel(m.type)}
                </span>
                <pre style={{
                  margin: 0,
                  padding: 0,
                  fontFamily: "'JetBrains Mono','Fira Code',monospace",
                  fontSize: 12,
                  lineHeight: '18px',
                  color: typeColor(m.type),
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  flex: 1,
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
}
