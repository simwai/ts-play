import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useLayoutEffect,
  useImperativeHandle,
} from 'react'
import { useTypeInfo, type TypeInfo } from '../hooks/useTypeInfo'
import { useTSDiagnostics, type TSDiagnostic } from '../hooks/useTSDiagnostics'
import { workerClient } from '../lib/workerClient'
import { TypeInfoBar } from './ui/TypeInfoBar'
import { buildHtml, buildSquiggles } from '../lib/editor-utils'

type Props = {
  value: string
  onChange: (v: string) => void
  onCursorChange?: (pos: number) => void
  language: 'typescript' | 'javascript'
  readOnly?: boolean
  extraLibs?: Record<string, string>
  keyboardOpen?: boolean
  keyboardHeight?: number
}

export type CodeEditorRef = {
  undo: () => void
  redo: () => void
}

const LINE_H = 24
const PAD_TOP = 16
const PAD_X = 16
const GUTTER_W = 48
const FONT_SIZE = 14
const CHAR_W = 8.4

const EMPTY_LIBS = {}

const layerStyle = (contentHeight: number): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  margin: 0,
  padding: `${PAD_TOP}px ${PAD_X}px`,
  fontSize: FONT_SIZE,
  lineHeight: `${LINE_H}px`,
  letterSpacing: '0',
  fontKerning: 'none',
  fontVariantLigatures: 'none',
  textRendering: 'geometricPrecision',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
  overflowY: 'hidden',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  minHeight: contentHeight,
  tabSize: 2,
})

export const CodeEditor = React.memo(
  React.forwardRef<CodeEditorRef, Props>(function CodeEditor(
    {
      value,
      onChange,
      onCursorChange,
      language,
      readOnly = false,
      extraLibs = EMPTY_LIBS,
      keyboardOpen = false,
      keyboardHeight = 0,
    },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const preRef = useRef<HTMLPreElement>(null)
    const gutterRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)
    const codeWrapRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined
    )
    const rafRef = useRef<number>(0)

    const { getTypeInfo } = useTypeInfo()
    const [typeInfo, setTypeInfo] = useState<TypeInfo | undefined>(undefined)
    const [lineHeights, setLineHeights] = useState<number[]>([])
    const diagnostics = useTSDiagnostics(
      value,
      language === 'typescript',
      extraLibs
    )
    const [activeDiag, setActiveDiag] = useState<TSDiagnostic | undefined>(
      undefined
    )

    const [completions, setCompletions] = useState<any[]>([])
    const [selIndex, setSelIndex] = useState(0)
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })

    const undoStack = useRef<Array<{ v: string; c: number }>>([])
    const redoStack = useRef<Array<{ v: string; c: number }>>([])
    const lastSaveTime = useRef<number>(0)
    const lastCursorPos = useRef<number>(0)
    const nextCursorPos = useRef<number | undefined>(undefined)

    // Synchronously restore cursor position after React updates the DOM
    useLayoutEffect(() => {
      if (nextCursorPos.current !== undefined && textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd =
          nextCursorPos.current
        lastCursorPos.current = nextCursorPos.current
        onCursorChange?.(nextCursorPos.current)
        nextCursorPos.current = undefined
      }
    }, [value, onCursorChange])

    const saveState = useCallback(
      (value_: string, cursor: number, force = false) => {
        const now = Date.now()
        if (force || now - lastSaveTime.current > 500) {
          undoStack.current.push({ v: value_, c: cursor })
          redoStack.current = []
          lastSaveTime.current = now
        }
      },
      []
    )

    const handleUndo = useCallback(() => {
      if (undoStack.current.length === 0) return
      const ta = textareaRef.current
      redoStack.current.push({ v: value, c: ta?.selectionStart || 0 })
      const previous = undoStack.current.pop()!
      
      nextCursorPos.current = previous.c
      onChange(previous.v)
    }, [value, onChange])

    const handleRedo = useCallback(() => {
      if (redoStack.current.length === 0) return
      const ta = textareaRef.current
      undoStack.current.push({ v: value, c: ta?.selectionStart || 0 })
      const next = redoStack.current.pop()!
      
      nextCursorPos.current = next.c
      onChange(next.v)
    }, [value, onChange])

    useImperativeHandle(
      ref,
      () => ({
        undo: handleUndo,
        redo: handleRedo,
      }),
      [handleUndo, handleRedo]
    )

    const linesArray = useMemo(() => value.split('\n'), [value])
    const lineCount = linesArray.length
    const measuredLineHeights = useMemo(
      () =>
        lineHeights.length === lineCount
          ? lineHeights
          : new Array(lineCount).fill(LINE_H),
      [lineHeights, lineCount]
    )
    const contentHeight = useMemo(
      () => measuredLineHeights.reduce((sum, h) => sum + h, 0) + PAD_TOP * 2,
      [measuredLineHeights]
    )

    const measureWraps = useCallback(() => {
      if (!measureRef.current) return
      const next = [...measureRef.current.children].map((child) =>
        Math.max(
          LINE_H,
          Math.ceil((child as HTMLElement).getBoundingClientRect().height)
        )
      )
      setLineHeights((previous) =>
        previous.length === next.length &&
        previous.every((v, i) => v === next[i])
          ? previous
          : next
      )
    }, [linesArray])

    useLayoutEffect(() => {
      if (!codeWrapRef.current) return
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(measureWraps)
      })
      ro.observe(codeWrapRef.current)
      return () => {
        ro.disconnect()
        cancelAnimationFrame(rafRef.current)
      }
    }, [measureWraps])

    useLayoutEffect(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measureWraps)
    }, [measureWraps])

    useEffect(() => {
      if (preRef.current) preRef.current.innerHTML = buildHtml(value) + '\n'
    }, [value])

    const onScroll = useCallback(() => {
      if (!scrollRef.current) return
      const { scrollTop } = scrollRef.current
      if (gutterRef.current) gutterRef.current.scrollTop = scrollTop
      if (textareaRef.current) textareaRef.current.scrollTop = scrollTop
    }, [])

    const scrollSelectionIntoView = useCallback(() => {
      const ta = textareaRef.current
      const scroller = scrollRef.current
      if (!ta || !scroller) return
      const pos = ta.selectionStart
      const before = value.slice(0, pos)
      const logicalLineIndex = Math.max(0, before.split('\n').length - 1)
      const y =
        PAD_TOP +
        measuredLineHeights
          .slice(0, logicalLineIndex)
          .reduce((sum, h) => sum + h, 0)
      const lineHeight = measuredLineHeights[logicalLineIndex] ?? LINE_H
      const visibleTop = scroller.scrollTop
      const bottomInset = keyboardOpen
        ? Math.min(120, Math.max(0, keyboardHeight * 0.12))
        : 0
      const visibleBottom =
        scroller.scrollTop + scroller.clientHeight - 56 - bottomInset

      if (y < visibleTop + 8)
        scroller.scrollTo({ top: Math.max(0, y - 24), behavior: 'smooth' })
      else if (y + lineHeight > visibleBottom)
        scroller.scrollTo({
          top: Math.max(
            0,
            y + lineHeight - scroller.clientHeight + 56 + bottomInset + 24
          ),
          behavior: 'smooth',
        })
    }, [keyboardHeight, keyboardOpen, measuredLineHeights, value])

    const triggerAutocomplete = useCallback(
      async (code: string, pos: number, explicit = false) => {
        if (language !== 'typescript') return
        const before = code.slice(0, pos)
        const match = /[\w$]+$/.exec(before)
        const prefix = match ? match[0] : ''
        const isDot = before.endsWith('.')

        if (!explicit && !match && !isDot) {
          setCompletions([])
          return
        }

        await workerClient.updateFile('main.ts', code)

        const entries = await workerClient.getCompletions(pos)
        if (entries && entries.length > 0) {
          const filtered = prefix
            ? entries.filter((e) =>
                e.name.toLowerCase().startsWith(prefix.toLowerCase())
              )
            : entries

          if (filtered.length > 0) {
            const logicalLineIndex = Math.max(0, before.split('\n').length - 1)
            const y =
              PAD_TOP +
              measuredLineHeights
                .slice(0, logicalLineIndex)
                .reduce((sum, h) => sum + h, 0) +
              (measuredLineHeights[logicalLineIndex] ?? LINE_H)
            const lastLine = before.split('\n').pop() || ''
            const x = PAD_X + (lastLine.length - prefix.length) * CHAR_W

            setPopupPos({ top: y, left: x })
            setCompletions(filtered.slice(0, 50))
            setSelIndex(0)
          } else {
            setCompletions([])
          }
        } else {
          setCompletions([])
        }
      },
      [language, measuredLineHeights]
    )

    const insertCompletion = useCallback(() => {
      if (completions.length === 0) return
      const ta = textareaRef.current
      if (!ta) return
      const pos = ta.selectionStart
      const before = value.slice(0, pos)
      const match = /[\w$]+$/.exec(before)
      const wordLength = match ? match[0].length : 0

      const comp = completions[selIndex]
      const insertText = comp.insertText || comp.name

      saveState(value, pos, true)
      const next =
        value.slice(0, pos - wordLength) + insertText + value.slice(pos)
      
      nextCursorPos.current = pos - wordLength + insertText.length
      onChange(next)
      setCompletions([])
    }, [completions, selIndex, value, onChange, saveState])

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (completions.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelIndex((i) => Math.min(i + 1, completions.length - 1))
            return
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelIndex((i) => Math.max(i - 1, 0))
            return
          }

          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            insertCompletion()
            return
          }

          if (e.key === 'Escape') {
            e.preventDefault()
            setCompletions([])
            return
          }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) {
          e.preventDefault()
          triggerAutocomplete(value, e.currentTarget.selectionStart, true)
          return
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault()
          if (e.shiftKey) handleRedo()
          else handleUndo()
          return
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault()
          handleRedo()
          return
        }

        if (e.key === 'Tab') {
          e.preventDefault()
          const ta = e.currentTarget
          const start = ta.selectionStart
          const end = ta.selectionEnd
          saveState(value, start, true)
          const next = value.slice(0, start) + '  ' + value.slice(end)
          
          nextCursorPos.current = start + 2
          onChange(next)
        }
      },
      [
        value,
        onChange,
        handleUndo,
        handleRedo,
        saveState,
        completions,
        insertCompletion,
        triggerAutocomplete,
      ]
    )

    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        const pos = e.target.selectionStart
        const isPasteOrCut = Math.abs(newValue.length - value.length) > 1
        saveState(value, lastCursorPos.current, isPasteOrCut)
        onChange(newValue)
        lastCursorPos.current = pos
        onCursorChange?.(pos)

        if (isPasteOrCut) {
          setCompletions([])
        } else {
          triggerAutocomplete(newValue, pos)
        }
      },
      [value, onChange, saveState, triggerAutocomplete, onCursorChange]
    )

    const updateTypeInfo = useCallback(() => {
      const ta = textareaRef.current
      if (!ta) return
      const pos = ta.selectionStart
      if (lastCursorPos.current !== pos) {
        lastCursorPos.current = pos
        onCursorChange?.(pos)
      }

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const info = await getTypeInfo(value, pos)
        setTypeInfo(info)
        const diag = diagnostics.find(
          (d) => pos >= d.start && pos <= d.start + d.length
        )
        setActiveDiag(diag)
        scrollSelectionIntoView()
      }, 80)
    }, [
      value,
      getTypeInfo,
      diagnostics,
      scrollSelectionIntoView,
      onCursorChange,
    ])

    useEffect(
      () => () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      },
      []
    )

    const onTouchStart = useCallback((e: React.TouchEvent) => {
      e.stopPropagation()
    }, [])

    const handleBlur = useCallback(() => {
      // Close autocomplete when editor loses focus
      setCompletions([])
    }, [])

    useEffect(() => {
      if (!keyboardOpen || readOnly) return
      const id = globalThis.setTimeout(() => {
        scrollSelectionIntoView()
      }, 50)
      return () => {
        globalThis.clearTimeout(id)
      }
    }, [keyboardOpen, readOnly, scrollSelectionIntoView])

    const gutterItems = useMemo(
      () =>
        linesArray.map((_, idx) => ({
          number: idx + 1,
          height: measuredLineHeights[idx],
        })),
      [linesArray, measuredLineHeights]
    )

    return (
      <div className='relative w-full h-full overflow-hidden flex flex-col font-mono'>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className='flex-1 overflow-y-auto overflow-x-hidden flex min-h-0 bg-base'
        >
          <div
            ref={gutterRef}
            className='shrink-0 overflow-hidden bg-mantle border-r border-surface0 select-none text-overlay0 text-right box-border'
            style={{
              width: GUTTER_W,
              paddingTop: PAD_TOP,
              paddingBottom: PAD_TOP,
              fontSize: FONT_SIZE,
              lineHeight: `${LINE_H}px`,
              paddingRight: 12,
              minHeight: contentHeight,
            }}
          >
            {gutterItems.map(({ number, height }) => (
              <div
                key={number}
                style={{
                  height,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                }}
              >
                {number}
              </div>
            ))}
          </div>
          <div
            ref={codeWrapRef}
            className='flex-1 relative min-w-0'
            style={{ minHeight: contentHeight }}
          >
            <div
              ref={measureRef}
              aria-hidden
              className='absolute inset-0 invisible pointer-events-none -z-10 box-border whitespace-pre-wrap wrap-break-word'
              style={{
                padding: `${PAD_TOP}px ${PAD_X}px`,
                fontSize: FONT_SIZE,
                lineHeight: `${LINE_H}px`,
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
                  {line === '' ? ' ' : line.replaceAll('\t', '  ')}
                </div>
              ))}
            </div>
            <pre
              ref={preRef}
              aria-hidden
              className='text-text bg-transparent pointer-events-none'
              style={layerStyle(contentHeight)}
            />
            <pre
              aria-hidden
              dangerouslySetInnerHTML={{
                __html: buildSquiggles(value, diagnostics),
              }}
              className='text-transparent bg-transparent pointer-events-none z-10'
              style={layerStyle(contentHeight)}
            />
            <textarea
              ref={textareaRef}
              value={value}
              readOnly={readOnly}
              onChange={handleTextChange}
              onKeyDown={onKeyDown}
              onSelect={updateTypeInfo}
              onClick={updateTypeInfo}
              onKeyUp={updateTypeInfo}
              onTouchStart={onTouchStart}
              onBlur={handleBlur}
              spellCheck={false}
              autoCorrect='off'
              autoCapitalize='off'
              autoComplete='off'
              wrap='soft'
              data-gramm='false'
              data-gramm_editor='false'
              data-enable-grammarly='false'
              className='text-transparent bg-transparent border-none outline-none resize-none z-20 caret-lavender'
              style={{
                ...layerStyle(contentHeight),
                height: contentHeight,
                WebkitTextFillColor: 'transparent',
                cursor: readOnly ? 'default' : 'text',
                touchAction: 'pan-y',
                caretShape: 'bar',
              }}
            />

            {completions.length > 0 && (
              <ul
                role="listbox"
                aria-label="Autocomplete suggestions"
                className='hidden md:block absolute m-0 p-0 list-none bg-mantle border border-surface1 rounded-md shadow-lg shadow-black/30 z-50 max-h-52 overflow-y-auto min-w-48 text-sm'
                style={{
                  top: popupPos.top,
                  left: popupPos.left,
                }}
                onMouseDown={(e) => {
                  // Prevent focus loss from textarea when clicking the scrollbar or popup
                  e.preventDefault()
                }}
              >
                {completions.map((comp, i) => (
                  <li
                    key={comp.name}
                    role="option"
                    aria-selected={i === selIndex}
                    className={`px-3 py-1.5 cursor-pointer flex justify-between gap-4 ${i === selIndex ? 'bg-surface0 text-text' : 'bg-transparent text-subtext0'}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSelIndex(i)
                      insertCompletion()
                    }}
                  >
                    <span>{comp.name}</span>
                    <span className='text-overlay0 text-xs'>
                      {comp.kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <TypeInfoBar
          typeInfo={typeInfo}
          activeDiag={activeDiag}
          language={language}
          gutterW={GUTTER_W}
        />
      </div>
    )
  })
)
