import React, { useRef, useCallback, useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { CatppuccinTheme, getSyntaxColors } from '../lib/theme';
import { tokenize } from '../lib/tokenizer';
import { useTypeInfo, type TypeInfo } from '../hooks/useTypeInfo';
import { useTSDiagnostics, type TSDiagnostic } from '../hooks/useTSDiagnostics';
import { TypeInfoBar } from './ui/TypeInfoBar';
import { workerClient } from '../lib/workerClient';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCursorChange?: (pos: number) => void;
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
const FONT      = "'Victor Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";
const FONT_SIZE = 13;
const CHAR_W    = 7.8; // Approx width of a monospace char at 13px

const EMPTY_LIBS = {};

function buildHtml(code: string, theme: CatppuccinTheme): string {
  const sc = getSyntaxColors(theme);
  const COLOR: Record<string, string> = {
    keyword: sc.keyword, string: sc.string, number: sc.number, comment: sc.comment,
    function: sc.function, type: sc.type, operator: sc.operator, punctuation: sc.punctuation,
    decorator: sc.decorator, variable: sc.variable, constant: sc.constant, boolean: sc.boolean,
    property: sc.property, parameter: sc.parameter, plain: theme.text,
  };
  return tokenize(code).map(tok => {
    const color = COLOR[tok.type] ?? theme.text;
    const safe = tok.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span style="color:${color}">${safe}</span>`;
  }).join('');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSquiggles(code: string, diagnostics: TSDiagnostic[], theme: CatppuccinTheme): string {
  if (!diagnostics.length) return escHtml(code);
  const sorted = [...diagnostics].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;
  for (const d of sorted) {
    const start = d.start;
    const end   = Math.min(d.start + d.length, code.length);
    if (start < cursor) continue;
    if (start > cursor) parts.push(escHtml(code.slice(cursor, start)));
    const color = d.category === 'error' ? theme.red : theme.yellow;
    parts.push(`<span style="text-decoration:underline wavy ${color};text-decoration-thickness:1.5px;text-underline-offset:3px;">${escHtml(code.slice(start, end))}</span>`);
    cursor = end;
  }
  if (cursor < code.length) parts.push(escHtml(code.slice(cursor)));
  return parts.join('');
}

const layerStyle = (contentHeight: number): React.CSSProperties => ({
  position: 'absolute', top: 0, left: 0, right: 0, margin: 0,
  padding: `${PAD_TOP}px ${PAD_X}px`, fontFamily: FONT, fontSize: FONT_SIZE,
  lineHeight: `${LINE_H}px`, letterSpacing: '0', fontKerning: 'none',
  fontVariantLigatures: 'none', textRendering: 'geometricPrecision',
  WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word',
  overflowY: 'hidden', overflowX: 'hidden', boxSizing: 'border-box',
  minHeight: contentHeight, tabSize: 2,
});

export const CodeEditor = React.memo(function CodeEditor({
  value, onChange, onCursorChange, language, readOnly = false, theme: t,
  extraLibs = EMPTY_LIBS, keyboardOpen = false, keyboardHeight = 0,
}: Props) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef      = useRef<HTMLPreElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);
  const measureRef  = useRef<HTMLDivElement>(null);
  const codeWrapRef = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef      = useRef<number>(0);

  const { getTypeInfo } = useTypeInfo();
  const [typeInfo, setTypeInfo] = useState<TypeInfo | null>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const diagnostics = useTSDiagnostics(value, language === 'typescript', extraLibs);
  const [activeDiag, setActiveDiag] = useState<TSDiagnostic | null>(null);

  // Autocomplete State
  const [completions, setCompletions] = useState<any[]>([]);
  const [selIndex, setSelIndex] = useState(0);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const undoStack = useRef<{ v: string; c: number }[]>([]);
  const redoStack = useRef<{ v: string; c: number }[]>([]);
  const lastSaveTime = useRef<number>(0);
  const lastCursorPos = useRef<number>(0);

  const saveState = useCallback((val: string, cursor: number, force = false) => {
    const now = Date.now();
    if (force || now - lastSaveTime.current > 500) {
      undoStack.current.push({ v: val, c: cursor });
      redoStack.current = [];
      lastSaveTime.current = now;
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const ta = textareaRef.current;
    redoStack.current.push({ v: value, c: ta?.selectionStart || 0 });
    const prev = undoStack.current.pop()!;
    onChange(prev.v);
    requestAnimationFrame(() => {
      if (ta) { 
        ta.selectionStart = ta.selectionEnd = prev.c; 
        lastCursorPos.current = prev.c; 
        onCursorChange?.(prev.c);
      }
    });
  }, [value, onChange, onCursorChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const ta = textareaRef.current;
    undoStack.current.push({ v: value, c: ta?.selectionStart || 0 });
    const next = redoStack.current.pop()!;
    onChange(next.v);
    requestAnimationFrame(() => {
      if (ta) { 
        ta.selectionStart = ta.selectionEnd = next.c; 
        lastCursorPos.current = next.c; 
        onCursorChange?.(next.c);
      }
    });
  }, [value, onChange, onCursorChange]);

  const linesArray = useMemo(() => value.split('\n'), [value]);
  const lineCount  = linesArray.length;
  const measuredLineHeights = useMemo(() => lineHeights.length === lineCount ? lineHeights : new Array(lineCount).fill(LINE_H), [lineHeights, lineCount]);
  const contentHeight = useMemo(() => measuredLineHeights.reduce((sum, h) => sum + h, 0) + PAD_TOP * 2, [measuredLineHeights]);

  const measureWraps = useCallback(() => {
    if (!measureRef.current) return;
    const next = Array.from(measureRef.current.children).map(child => Math.max(LINE_H, Math.ceil((child as HTMLElement).getBoundingClientRect().height)));
    setLineHeights(prev => (prev.length === next.length && prev.every((v, i) => v === next[i])) ? prev : next);
  }, [linesArray]);

  useLayoutEffect(() => {
    if (!codeWrapRef.current) return;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measureWraps); });
    ro.observe(codeWrapRef.current);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [measureWraps]);

  useLayoutEffect(() => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(measureWraps); }, [measureWraps]);

  useEffect(() => { if (preRef.current) preRef.current.innerHTML = buildHtml(value, t) + '\n'; }, [value, t]);

  const onScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
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
    const bottomInset = keyboardOpen ? Math.min(120, Math.max(0, keyboardHeight * 0.12)) : 0;
    const visibleBottom = scroller.scrollTop + scroller.clientHeight - 56 - bottomInset;

    if (y < visibleTop + 8) scroller.scrollTo({ top: Math.max(0, y - 24), behavior: 'smooth' });
    else if (y + lineHeight > visibleBottom) scroller.scrollTo({ top: Math.max(0, y + lineHeight - scroller.clientHeight + 56 + bottomInset + 24), behavior: 'smooth' });
  }, [keyboardHeight, keyboardOpen, measuredLineHeights, value]);

  const triggerAutocomplete = useCallback(async (code: string, pos: number, explicit = false) => {
    if (language !== 'typescript') return;
    const before = code.slice(0, pos);
    const match = before.match(/[\w$]+$/);
    const prefix = match ? match[0] : '';
    const isDot = before.endsWith('.');
    
    if (!explicit && !match && !isDot) {
      setCompletions([]);
      return;
    }

    // Ensure worker has the latest code before requesting completions
    await workerClient.updateFile('main.ts', code);

    const entries = await workerClient.getCompletions(pos);
    if (entries && entries.length > 0) {
      // Filter entries by the current word prefix
      const filtered = prefix
        ? entries.filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()))
        : entries;

      if (filtered.length > 0) {
        const logicalLineIndex = Math.max(0, before.split('\n').length - 1);
        const y = PAD_TOP + measuredLineHeights.slice(0, logicalLineIndex).reduce((sum, h) => sum + h, 0) + (measuredLineHeights[logicalLineIndex] ?? LINE_H);
        const lastLine = before.split('\n').pop() || '';
        // Adjust X position to start of the word
        const x = PAD_X + ((lastLine.length - prefix.length) * CHAR_W);
        
        setPopupPos({ top: y, left: x });
        setCompletions(filtered.slice(0, 50)); // Limit to 50 for perf
        setSelIndex(0);
      } else {
        setCompletions([]);
      }
    } else {
      setCompletions([]);
    }
  }, [language, measuredLineHeights]);

  const insertCompletion = useCallback(() => {
    if (completions.length === 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = value.slice(0, pos);
    const match = before.match(/[\w$]+$/);
    const wordLen = match ? match[0].length : 0;
    
    const comp = completions[selIndex];
    const insertText = comp.insertText || comp.name;
    
    saveState(value, pos, true);
    const next = value.slice(0, pos - wordLen) + insertText + value.slice(pos);
    onChange(next);
    setCompletions([]);
    
    requestAnimationFrame(() => {
      const newPos = pos - wordLen + insertText.length;
      ta.selectionStart = ta.selectionEnd = newPos;
      lastCursorPos.current = newPos;
      onCursorChange?.(newPos);
    });
  }, [completions, selIndex, value, onChange, saveState, onCursorChange]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (completions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIndex(i => Math.min(i + 1, completions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertCompletion(); return; }
      if (e.key === 'Escape') { e.preventDefault(); setCompletions([]); return; }
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      triggerAutocomplete(value, e.currentTarget.selectionStart, true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) handleRedo(); else handleUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault(); handleRedo(); return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      saveState(value, start, true);
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => { 
        ta.selectionStart = ta.selectionEnd = start + 2; 
        lastCursorPos.current = start + 2; 
        onCursorChange?.(start + 2);
      });
      return;
    }
  }, [value, onChange, handleUndo, handleRedo, saveState, completions, insertCompletion, triggerAutocomplete, onCursorChange]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const pos = e.target.selectionStart;
    const isPasteOrCut = Math.abs(newVal.length - value.length) > 1;
    saveState(value, lastCursorPos.current, isPasteOrCut);
    onChange(newVal);
    lastCursorPos.current = pos;
    onCursorChange?.(pos);

    // Auto-trigger completions on typing
    if (!isPasteOrCut) {
      triggerAutocomplete(newVal, pos);
    } else {
      setCompletions([]);
    }
  }, [value, onChange, saveState, triggerAutocomplete, onCursorChange]);

  const updateTypeInfo = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    if (lastCursorPos.current !== pos) {
      lastCursorPos.current = pos;
      onCursorChange?.(pos);
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const info = await getTypeInfo(value, pos);
      setTypeInfo(info ?? null);
      const diag = diagnostics.find(d => pos >= d.start && pos <= d.start + d.length);
      setActiveDiag(diag ?? null);
      scrollSelectionIntoView();
    }, 80);
  }, [value, getTypeInfo, diagnostics, scrollSelectionIntoView, onCursorChange]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const suppressCtx = useCallback((e: React.MouseEvent | React.TouchEvent) => e.preventDefault(), []);
  const onTouchStart = useCallback((e: React.TouchEvent) => e.stopPropagation(), []);

  useEffect(() => {
    if (!keyboardOpen || readOnly) return;
    const id = window.setTimeout(() => scrollSelectionIntoView(), 50);
    return () => window.clearTimeout(id);
  }, [keyboardOpen, readOnly, scrollSelectionIntoView]);

  const gutterItems = useMemo(() => linesArray.map((_, idx) => ({ number: idx + 1, height: measuredLineHeights[idx] })), [linesArray, measuredLineHeights]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', minHeight: 0, background: t.base, paddingBottom: keyboardOpen ? Math.min(24, Math.round(keyboardHeight * 0.06)) : 0 }}>
        <div ref={gutterRef} style={{ width: GUTTER_W, flexShrink: 0, overflowY: 'hidden', overflowX: 'hidden', paddingTop: PAD_TOP, paddingBottom: PAD_TOP, background: t.mantle, borderRight: `1px solid ${t.surface0}`, userSelect: 'none', fontFamily: FONT, fontSize: FONT_SIZE, lineHeight: `${LINE_H}px`, color: t.overlay0, textAlign: 'right', paddingRight: 8, boxSizing: 'border-box', minHeight: contentHeight }}>
          {gutterItems.map(({ number, height }) => <div key={number} style={{ height, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>{number}</div>)}
        </div>
        <div ref={codeWrapRef} style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: contentHeight }}>
          <div ref={measureRef} aria-hidden style={{ position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none', zIndex: -1, padding: `${PAD_TOP}px ${PAD_X}px`, fontFamily: FONT, fontSize: FONT_SIZE, lineHeight: `${LINE_H}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', boxSizing: 'border-box' }}>
            {linesArray.map((line, idx) => <div key={`measure-${idx}`} style={{ minHeight: LINE_H, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{line === '' ? ' ' : line.replace(/\t/g, '  ')}</div>)}
          </div>
          <pre ref={preRef} aria-hidden style={{ ...layerStyle(contentHeight), color: t.text, background: 'transparent', pointerEvents: 'none' }} />
          <pre aria-hidden dangerouslySetInnerHTML={{ __html: buildSquiggles(value, diagnostics, t) }} style={{ ...layerStyle(contentHeight), color: 'transparent', background: 'transparent', pointerEvents: 'none', zIndex: 1 }} />
          <textarea ref={textareaRef} value={value} readOnly={readOnly} onChange={handleTextChange} onKeyDown={onKeyDown} onSelect={updateTypeInfo} onClick={updateTypeInfo} onKeyUp={updateTypeInfo} onContextMenu={suppressCtx} onTouchStart={onTouchStart} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off" wrap="soft" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" style={{ ...layerStyle(contentHeight), height: contentHeight, color: 'transparent', caretColor: t.lavender, background: 'transparent', border: 'none', outline: 'none', resize: 'none', WebkitTextFillColor: 'transparent', cursor: readOnly ? 'default' : 'text', zIndex: 2, touchAction: 'pan-y', caretShape: 'bar' }} />
          
          {/* Autocomplete Popup */}
          {completions.length > 0 && (
            <ul style={{
              position: 'absolute',
              top: popupPos.top,
              left: popupPos.left,
              margin: 0,
              padding: 0,
              listStyle: 'none',
              background: t.mantle,
              border: `1px solid ${t.surface1}`,
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 50,
              maxHeight: 150,
              overflowY: 'auto',
              fontFamily: FONT,
              fontSize: 12,
              minWidth: 150,
            }}>
              {completions.map((comp, i) => (
                <li
                  key={comp.name}
                  style={{
                    padding: '4px 8px',
                    background: i === selIndex ? t.surface0 : 'transparent',
                    color: i === selIndex ? t.text : t.subtext0,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    setSelIndex(i);
                    insertCompletion();
                  }}
                >
                  <span>{comp.name}</span>
                  <span style={{ color: t.overlay0, fontSize: 10 }}>{comp.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <TypeInfoBar typeInfo={typeInfo} activeDiag={activeDiag} language={language} gutterW={GUTTER_W} theme={t} />
    </div>
  );
});
