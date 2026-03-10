import React from 'react';
import { CatppuccinTheme } from '../../lib/theme';
import { TypeInfo } from '../../hooks/useTypeInfo';
import { TSDiagnostic } from '../../hooks/useTSDiagnostics';

const FONT = "'JetBrains Mono','Fira Code','Cascadia Code',monospace";

interface TypeInfoBarProps {
  typeInfo:   TypeInfo | null;
  activeDiag: TSDiagnostic | null;
  language:   'typescript' | 'javascript';
  gutterW:    number;
  theme:      CatppuccinTheme;
}

// Helper to find URLs in text and make them clickable
function renderWithLinks(text: string, t: CatppuccinTheme) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: t.blue,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function TypeInfoBar({ typeInfo, activeDiag, language, gutterW, theme: t }: TypeInfoBarProps) {
  const hasDiag     = !!activeDiag;
  const hasTypeInfo = !hasDiag && !!typeInfo;
  const isEmpty     = !hasDiag && !hasTypeInfo;

  return (
    <div style={{
      flexShrink:     0,
      background:     t.mantle,
      borderTop:      `1px solid ${t.surface0}`,
      paddingLeft:    gutterW + 8,
      paddingRight:   10,
      paddingTop:     5,
      paddingBottom:  5,
      fontFamily:     FONT,
      fontSize:       11,
      // Responsive: wraps and scrolls — never squeezes into one line
      overflowY:      'auto',
      maxHeight:      96,  // ~4 lines max before scroll kicks in
      minHeight:      26,
      boxSizing:      'border-box',
      // Ensure pointer events work for links
      pointerEvents:  'auto',
    }}>

      {/* ── Diagnostic message ── */}
      {hasDiag && (
        <DiagRow diag={activeDiag!} t={t} />
      )}

      {/* ── Type info ── */}
      {hasTypeInfo && (
        <TypeRow info={typeInfo!} t={t} />
      )}

      {/* ── Empty hint ── */}
      {isEmpty && (
        <span style={{ color: t.overlay0, fontSize: 10, fontStyle: 'italic' }}>
          {language === 'typescript'
            ? 'Move cursor over a symbol for type info'
            : 'JavaScript output'}
        </span>
      )}
    </div>
  );
}

// ── Diagnostic row ────────────────────────────────────────────────────────────
function DiagRow({ diag, t }: { diag: TSDiagnostic; t: CatppuccinTheme }) {
  const isError = diag.category === 'error';
  const color   = isError ? t.red : t.yellow;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ color, flexShrink: 0, lineHeight: '16px' }}>
        {isError ? '✖' : '⚠'}
      </span>
      <span style={{
        color,
        whiteSpace:   'pre-wrap',
        wordBreak:    'break-word',
        lineHeight:   '16px',
        flex:         1,
      }}>
        {diag.message}
      </span>
      <span style={{ color: t.overlay0, flexShrink: 0, lineHeight: '16px', fontSize: 10 }}>
        [{diag.line + 1}:{diag.character + 1}]
      </span>
    </div>
  );
}

// ── Type info rows ────────────────────────────────────────────────────────────
function TypeRow({ info, t }: { info: TypeInfo; t: CatppuccinTheme }) {
  const kc = kindColor(info.kind, t);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* First row: kind chip + name + colon + type annotation */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        {/* Kind chip */}
        <span style={{
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color:         kc,
          background:    `${kc}20`,
          border:        `1px solid ${kc}40`,
          borderRadius:  3,
          padding:       '1px 4px',
          flexShrink:    0,
          lineHeight:    '14px',
        }}>
          {info.kind}
        </span>

        {/* Name */}
        <span style={{ color: t.text, fontWeight: 600, flexShrink: 0 }}>
          {info.name}
        </span>

        {/* Colon */}
        <span style={{ color: t.overlay0, flexShrink: 0 }}>:</span>

        {/* Type annotation — wraps naturally, no truncation */}
        <span style={{
          color:      t.yellow,
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
          flex:       '1 1 120px',
          minWidth:   0,
        }}>
          {info.typeAnnotation}
        </span>
      </div>

      {/* Second row: JSDoc (if present) */}
      {info.jsDoc && (
        <div style={{
          color:      t.overlay1,
          fontSize:   10,
          fontStyle:  'italic',
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
          lineHeight: '15px',
          paddingLeft: 4,
          borderLeft: `2px solid ${t.surface1}`,
        }}>
          {renderWithLinks(info.jsDoc, t)}
        </div>
      )}

      {/* Third row: signature (if present and different from typeAnnotation) */}
      {info.signature && info.signature !== info.typeAnnotation && (
        <div style={{
          color:      t.overlay1,
          fontSize:   10,
          whiteSpace: 'pre-wrap',
          wordBreak:  'break-word',
          lineHeight: '15px',
        }}>
          {renderWithLinks(info.signature, t)}
        </div>
      )}
    </div>
  );
}

function kindColor(kind: string, t: CatppuccinTheme): string {
  switch (kind) {
    case 'function':  return t.blue;
    case 'type':      return t.yellow;
    case 'interface': return t.teal;
    case 'class':     return t.green;
    case 'parameter': return t.maroon;
    case 'property':  return t.sapphire;
    case 'keyword':   return t.mauve;
    case 'builtin':   return t.peach;
    default:          return t.lavender;
  }
}
