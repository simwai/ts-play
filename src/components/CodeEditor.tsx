import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { CatppuccinTheme, getSyntaxColors } from '../lib/theme';
import { tokenize } from '../lib/tokenizer';
import { useTypeInfo, type TypeInfo } from '../hooks/useTypeInfo';
import { useTSDiagnostics, type TSDiagnostic } from '../hooks/useTSDiagnostics';

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: 'typescript' | 'javascript';
  readOnly?: boolean;
  theme: CatppuccinTheme;
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

function buildSquiggles(code: string, diagnostics: TSDiagnostic[], theme: CatppuccinTheme): string {
  if (!diagnostics.length) return '';
  const sorted = [...diagnostics].sort((a, b) => a.start - b.start);
  let out = [];
  let lastIndex = 0;
  
  for (const d of sorted) {
    if (d.start < lastIndex) continue;
    
    out.push(code.substring(lastIndex, d.start)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'));
      
    const problem = code.substring(d.start, d.start + d.length)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    const color = d.category === 'error' ? theme.red : theme.yellow;
    out.push(`<span style="text-decoration: underline wavy ${color}; text-decoration-thickness: 1.5px; text-underline-offset: 3px;">${problem}</span>`);
    
    lastIndex = d.start + d.length;
  }
  out.push(code.substring(lastIndex)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'));
    
  return out.join('');
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
  whiteSpace:    'pre-wrap',
  wordBreak:     'break-word',
  overflowWrap:  'break-word',
  overflowY:     'hidden',
  overflowX:     'hidden',
  boxSizing:     'border-box',
  minHeight:     contentHeight,
  tabSize:       2,
});

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  theme: t,
}: Props) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef      = useRef<HTMLPreElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);
  const codeWrapRef = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef      = useRef<number>(0);

  const { getTypeInfo } = useTypeInfo();
  const [typeInfo, setTypeInfo] = useState<TypeInfo | null>(null);
  const [wrapCounts, setWrapCounts] = useState<number[]>([]);

  const diagnostics = useTSDiagnostics(value, language === 'typescript');
  const [activeDiag, setActiveDiag] = useState<TSDiagnostic | null>(null);

  // Split value into logical lines once
  const linesArray = useMemo(() => value.split('\n'), [value]);
  const lineCount  = linesArray.length;

  // Visual wrap counts — one entry per logical line
  // Default to 1 until measured
  const lineWrap = useMemo((): number[] => {
    if (wrapCounts.length === lineCount) return wrapCounts;
    return new Array(lineCount).fill(1);
  }, [wrapCounts, lineCount]);

  // Total pixel height of the content area
  const contentHeight = useMemo(() => {
    const visual = lineWrap.reduce((s, n) => s + n, 0);
    return visual * LINE_H + PAD_TOP * 2;
  }, [lineWrap]);

  // ── Wrap measurement ──────────────────────────────────────────────────────
  // We use a hidden <canvas> to measure each logical line's pixel width,
  // then divide by the available code-surface width to get visual line count.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const measureWraps = useCallback(() => {
    const wrap = codeWrapRef.current;
    if (!wrap) return;
    const availW = wrap.clientWidth - PAD_X * 2;
    if (availW <= 0) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.font = `${FONT_SIZE}px ${FONT}`;

    const next = linesArray.map(line => {
      const w = ctx.measureText(line.replace(/\t/g, '  ') || ' ').width;
      return Math.max(1, Math.ceil(w / availW));
    });
    setWrapCounts(next);
  }, [linesArray]);

  // Re-measure when content or container width changes
  useEffect(() => {
    const wrap = codeWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureWraps);
    });
    ro.observe(wrap);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [measureWraps]);

  useEffect(() => {
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
    }, 80);
  }, [value, getTypeInfo, diagnostics]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Suppress native context menu (prevents long-press menu on mobile)
  const suppressCtx = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  // ── Gutter lines ──────────────────────────────────────────────────────────
  // Each real line occupies (lineWrap[idx] * LINE_H) px in the gutter,
  // showing the line number only at the top of its visual block.
  const gutterItems = useMemo(() => (
    linesArray.map((_, idx) => ({
      number: idx + 1,
      height: lineWrap[idx] * LINE_H,
    }))
  ), [linesArray, lineWrap]);

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
            // must be at least contentHeight so gutter scrollTop sync works
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

          {/* Squiggles layer */}
          {diagnostics.length > 0 && (
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
          )}

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
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
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
              // Allow vertical pan (scroll) but block horizontal so swipe works
              touchAction:         'pan-y',
            }}
          />
        </div>
      </div>

      {/* ── Type-info status bar ── */}
      <div style={{
        height:         22,
        flexShrink:     0,
        background:     t.mantle,
        borderTop:      `1px solid ${t.surface0}`,
        display:        'flex',
        alignItems:     'center',
        paddingLeft:    GUTTER_W + 8,
        paddingRight:   8,
        gap:            6,
        overflow:       'hidden',
        fontFamily:     FONT,
        fontSize:       11,
      }}>
        {activeDiag ? (
          <>
            <span style={{ color: activeDiag.category === 'error' ? t.red : t.yellow, flexShrink: 0 }}>
              {activeDiag.category === 'error' ? '✖' : '⚠'}
            </span>
            <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeDiag.message}
            </span>
          </>
        ) : typeInfo ? (
          <>
            {/* Kind chip */}
            <span style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color:         kindColor(typeInfo.kind, t),
              background:    `${kindColor(typeInfo.kind, t)}22`,
              border:        `1px solid ${kindColor(typeInfo.kind, t)}44`,
              borderRadius:  3,
              padding:       '1px 4px',
              flexShrink:    0,
            }}>
              {typeInfo.kind}
            </span>

            {/* Name */}
            <span style={{ color: t.text, fontWeight: 600, flexShrink: 0 }}>
              {typeInfo.name}
            </span>

            {/* Colon */}
            <span style={{ color: t.overlay0, flexShrink: 0 }}>:</span>

            {/* Type — scrollable if long */}
            <span style={{
              color:        t.yellow,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              flex:         1,
            }}>
              {typeInfo.typeAnnotation}
            </span>

            {/* JSDoc hint */}
            {typeInfo.jsDoc && (
              <span style={{
                color:        t.overlay0,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
                maxWidth:     180,
                fontStyle:    'italic',
              }}>
                — {typeInfo.jsDoc.split('\n')[0]}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: t.overlay0, fontSize: 10, fontStyle: 'italic' }}>
            {language === 'typescript'
              ? 'Move cursor over a symbol for type info'
              : 'JavaScript output'}
          </span>
        )}
      </div>
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
