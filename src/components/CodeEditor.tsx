import React, { useRef, useCallback, useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { CatppuccinTheme, getSyntaxColors } from '../lib/theme';
import { tokenize } from '../lib/tokenizer';
import { useTypeInfo, type TypeInfo } from '../hooks/useTypeInfo';
import { useTSDiagnostics, type TSDiagnostic } from '../hooks/useTSDiagnostics';
import { TypeInfoBar } from './ui/TypeInfoBar';

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: 'typescript' | 'javascript';
  readOnly?: boolean;
  theme: CatppuccinTheme;
  extraLibs?: Record<string, string>;
  keyboardOpen?: boolean;
  keyboardHeight?: number;
}

const LINE_H    = 20;
const PAD_TOP   = 12;
const PAD_X     = 12;
const GUTTER_W  = 44;
const FONT      = "'JetBrains Mono','Fira Code','Cascadia Code',monospace";
const FONT_SIZE = 13;

// Build highlighted HTML from source
function buildHtml(code: string, theme: CatppuccinTheme): string {
  const sc = getSyntaxColors(theme);
  const COLOR: Record<string, string> = {
    keyword:     sc.keyword,
    string:      sc.string,
    number:      sc.number,
    comment:     sc.comment,
    function:    sc.function,
    type:        sc.type,
    operator:    sc.operator,
    punctuation: sc.punctuation,
    decorator:   sc.decorator,
    variable:    sc.variable,
    constant:    sc.constant,
    boolean:     sc.boolean,
    property:    sc.property,
    parameter:   sc.parameter,
    plain:       theme.text,
  };
  return tokenize(code)
    .map(tok => {
      const color = COLOR[tok.type] ?? theme.text;
      const safe = tok.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<span style="color:${color}">${safe}</span>`;
    })
    .join('');
}

// Squiggles layer: the entire code is rendered as transparent text so
// character positions exactly match the textarea. We wrap only the
// diagnostic spans with a wavy underline; everything else is plain text.
// IMPORTANT: we must HTML-escape every segment so that entity-encoded
// characters (& < >) don't shift the underline positions.
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSquiggles(code: string, diagnostics: TSDiagnostic[], theme: CatppuccinTheme): string {
  if (!diagnostics.length) return escHtml(code);

  // Sort and de-overlap: skip any diagnostic whose start falls inside a
  // previously rendered span so we never double-encode a region.
  const sorted = [...diagnostics].sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;

  for (const d of sorted) {
    const start = d.start;
    const end   = Math.min(d.start + d.length, code.length);
    if (start < cursor) continue;            // overlapping — skip
    if (start > cursor) {
      parts.push(escHtml(code.slice(cursor, start)));
    }
    const color = d.category === 'error' ? theme.red : theme.yellow;
    parts.push(
      `<span style="text-decoration:underline wavy ${color};` +
      `text-decoration-thickness:1.5px;text-underline-offset:3px;">` +
      escHtml(code.slice(start, end)) +
      `</span>`
    );
    cursor = end;
  }

  if (cursor < code.length) parts.push(escHtml(code.slice(cursor)));
  return parts.join('');
}

// Shared style for both textarea and pre so they stay pixel-perfect in sync
const layerStyle = (contentHeight: number): React.CSSProperties => ({
  position:      'absolute',
  top:           0,
  left:          0,
  right:         0,
  margin:        0,
  padding:       `${PAD_TOP}px ${PAD_X}px`,
  fontFamily:    FONT,
  fontSize:      FONT_SIZE,
  lineHeight:    `${LINE_H}px`,
  letterSpacing: '0',
  fontKerning:   'none',
  fontVariantLigatures: 'none',
  textRendering: 'geometricPrecision',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  whiteSpace:    'pre-wrap',
  wordBreak:     'break-word',
  overflowWrap:  'break-word',
  overflowY:     'hidden',
  overflowX:     'hidden',
  boxSizing:     'border-box',
  minHeight:     contentHeight,
  tabSize:       2,
});

export const CodeEditor = React.memo(function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  theme: t,
  extraLibs = {},
  keyboardOpen = false,
  keyboardHeight = 0,
}: Props) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef      = useRef<HTMLPreElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);
  const codeWrapRef = useRef<HTMLDivElement>(null);
  const measureRef  = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef      = useRef<number>(0);

  const { getTypeInfo } = useTypeInfo();
  const [typeInfo, setTypeInfo] = useState<TypeInfo | null>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  const diagnostics = useTSDiagnostics(value, language === 'typescript', extraLibs);
  const [activeDiag, setActiveDiag] = useState<TSDiagnostic | null>(null);

  // Split value into logical lines once
  const linesArray = useMemo(() => value.split('\n'), [value]);
  const lineCount  = linesArray.length;

  // Exact measured pixel height for each logical line. This avoids
  // cumulative rounding drift where the gutter can end up shorter than
  // the rendered wrapped code.
  const measuredLineHeights = useMemo((): number[] => {
    if (lineHeights.length === lineCount) return lineHeights;
    return new Array(lineCount).fill(LINE_H);
  }, [lineHeights, lineCount]);

  // Total pixel height of the content area
  const contentHeight = useMemo(() => {
    const visualHeight = measuredLineHeights.reduce((sum, h) => sum + h, 0);
    return visualHeight + PAD_TOP * 2;
  }, [measuredLineHeights]);

  const measureWraps = useCallback(() => {
    const measureRoot = measureRef.current;
    if (!measureRoot) return;

    const next = Array.from(measureRoot.children).map((child) => {
      const height = Math.max(LINE_H, Math.ceil((child as HTMLElement).getBoundingClientRect().height));
      return height;
    });

    setLineHeights((prev) => {
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, [linesArray]);

  // Re-measure when content or container width changes
  useLayoutEffect(() => {
    const wrap = codeWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureWraps);
    });
    ro.observe(wrap);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [measureWraps]);

  useLayoutEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measureWraps);
  }, [measureWraps]);

  // ── Syntax highlight ──────────────────────────────────────────────────────
  useEffect(() => {
    if (preRef.current) {
      preRef.current.innerHTML = buildHtml(value, t) + '\n';
    }
  }, [value, t]);

  // ── Scroll sync ───────────────────────────────────────────────────────────
  // The outer scrollRef div is the ONE scroll master.
  // The textarea and pre have overflow:hidden so they never scroll on their own.
  const onScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const { scrollTop } = scroller;
    // Sync gutter (it has overflow:hidden so we set scrollTop directly)
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
    // Keep textarea scroll in sync so the caret stays at the right position
    if (textareaRef.current) textareaRef.current.scrollTop = scrollTop;
  }, []);

  const scrollSelectionIntoView = useCallback(() => {
    const ta = textareaRef.current;
    const scroller = scrollRef.current;
    if (!ta || !scroller) return;

    const pos = ta.selectionStart;
    const before = value.slice(0, pos);
    const logicalLineIndex = Math.max(0, before.split('\n').length - 1);
    const y = PAD_TOP + measuredLineHeights.slice(0, logicalLineIndex).reduce((sum, h) => sum + h, 0);
    const lineHeight = measuredLineHeights[logicalLineIndex] ?? LINE_H;
    const visibleTop = scroller.scrollTop;
    const typeBarAllowance = 56;
    const bottomInset = keyboardOpen ? Math.min(120, Math.max(0, keyboardHeight * 0.12)) : 0;
    const visibleBottom = scroller.scrollTop + scroller.clientHeight - typeBarAllowance - bottomInset;

    if (y < visibleTop + 8) {
      scroller.scrollTo({ top: Math.max(0, y - 24), behavior: 'smooth' });
      return;
    }
    if (y + lineHeight > visibleBottom) {
      scroller.scrollTo({ top: Math.max(0, y + lineHeight - scroller.clientHeight + typeBarAllowance + bottomInset + 24), behavior: 'smooth' });
    }
  }, [keyboardHeight, keyboardOpen, measuredLineHeights, value]);

  // ── Tab key ───────────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta    = e.currentTarget;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = value.slice(0, start) + '  ' + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  }, [value, onChange]);

  // ── Type info (debounced) ─────────────────────────────────────────────────
  const updateTypeInfo = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pos = ta.selectionStart;
      const info = getTypeInfo(value, pos);
      setTypeInfo(info ?? null);
      
      const diag = diagnostics.find(d => pos >= d.start && pos <= d.start + d.length);
      setActiveDiag(diag ?? null);
      scrollSelectionIntoView();
    }, 80);
  }, [value, getTypeInfo, diagnostics, scrollSelectionIntoView]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Suppress native context menu (prevents long-press menu on mobile)
  const suppressCtx = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!keyboardOpen || readOnly) return;
    const id = window.setTimeout(() => scrollSelectionIntoView(), 50);
    return () => window.clearTimeout(id);
  }, [keyboardOpen, readOnly, scrollSelectionIntoView]);

  // ── Gutter lines ──────────────────────────────────────────────────────────
  // Each real line occupies (lineWrap[idx] * LINE_H) px in the gutter,
  // showing the line number only at the top of its visual block.
  const gutterItems = useMemo(() => (
    linesArray.map((_, idx) => ({
      number: idx + 1,
      height: measuredLineHeights[idx],
    }))
  ), [linesArray, measuredLineHeights]);

  return (
    <div style={{
      position: 'relative',
      width:    '100%',
      height:   '100%',
      overflow: 'hidden',
      display:  'flex',
      flexDirection: 'column',
    }}>

      {/* ── Scrollable body ── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex:       1,
          overflowY:  'auto',
          overflowX:  'hidden',
          display:    'flex',
          minHeight:  0,
          background: t.base,
          paddingBottom: keyboardOpen ? Math.min(24, Math.round(keyboardHeight * 0.06)) : 0,
        }}
      >
        {/* Gutter */}
        <div
          ref={gutterRef}
          style={{
            width:       GUTTER_W,
            flexShrink:  0,
            overflowY:   'hidden',
            overflowX:   'hidden',
            paddingTop:  PAD_TOP,
            paddingBottom: PAD_TOP,
            background:  t.mantle,
            borderRight: `1px solid ${t.surface0}`,
            userSelect:  'none',
            fontFamily:  FONT,
            fontSize:    FONT_SIZE,
            lineHeight:  `${LINE_H}px`,
            color:       t.overlay0,
            textAlign:   'right',
            paddingRight: 8,
            boxSizing:   'border-box',
            // Match the code content height exactly so the gutter never
            // ends early when many wrapped lines are present.
            minHeight:   contentHeight,
          }}
        >
          {gutterItems.map(({ number, height }) => (
            <div
              key={number}
              style={{
                height,
                // number sits at the TOP of the logical line block
                display:        'flex',
                alignItems:     'flex-start',
                justifyContent: 'flex-end',
              }}
            >
              {number}
            </div>
          ))}
        </div>

        {/* Code surface */}
        <div
          ref={codeWrapRef}
          style={{
            flex:     1,
            position: 'relative',
            minWidth: 0,
            minHeight: contentHeight,
          }}
        >
          {/* Hidden line-height measurement layer so gutter heights match browser wrapping exactly */}
          <div
            ref={measureRef}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
              zIndex: -1,
              padding: `${PAD_TOP}px ${PAD_X}px`,
              fontFamily: FONT,
              fontSize: FONT_SIZE,
              lineHeight: `${LINE_H}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              boxSizing: 'border-box',
            }}
          >
            {linesArray.map((line, idx) => (
              <div
                key={`measure-${idx}`}
                style={{
                  minHeight: LINE_H,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {line === '' ? ' ' : line.replace(/\t/g, '  ')}
              </div>
            ))}
          </div>

          {/* Highlighted layer (aria-hidden) */}
          <pre
            ref={preRef}
            aria-hidden
            style={{
              ...layerStyle(contentHeight),
              color:         t.text,
              background:    'transparent',
              pointerEvents: 'none',
            }}
          />

          {/* Squiggles layer — always mounted so layout never shifts.
              color:transparent hides the text; only the wavy underline shows. */}
          <pre
            aria-hidden
            dangerouslySetInnerHTML={{ __html: buildSquiggles(value, diagnostics, t) }}
            style={{
              ...layerStyle(contentHeight),
              color:         'transparent',
              background:    'transparent',
              pointerEvents: 'none',
              zIndex:        1,
            }}
          />

          {/* Editable textarea — transparent text, visible caret */}
          <textarea
            ref={textareaRef}
            value={value}
            readOnly={readOnly}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onSelect={updateTypeInfo}
            onClick={updateTypeInfo}
            onKeyUp={updateTypeInfo}
            onContextMenu={suppressCtx}
            onTouchStart={onTouchStart}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            wrap="soft"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            style={{
              ...layerStyle(contentHeight),
              height:              contentHeight,
              color:               'transparent',
              caretColor:          t.lavender,
              background:          'transparent',
              border:              'none',
              outline:             'none',
              resize:              'none',
              WebkitTextFillColor: 'transparent',
              cursor:              readOnly ? 'default' : 'text',
              zIndex:              2,
              // Allow vertical pan (scroll). Keep horizontal interaction for caret movement.
              touchAction:         'pan-y',
              caretShape:          'bar',
            }}
          />
        </div>
      </div>

      {/* ── Type-info status bar ── */}
      <TypeInfoBar
        typeInfo={typeInfo}
        activeDiag={activeDiag}
        language={language}
        gutterW={GUTTER_W}
        theme={t}
      />
    </div>
  );
});
