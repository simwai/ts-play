import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { workerClient } from '../lib/workerClient'
import { buildHtml, buildSquiggles } from '../lib/editor-utils'
import { TypeInfoBar } from './ui/TypeInfoBar'
import { cn } from '../lib/utils'
import type { TSDiagnostic } from '../hooks/useTSDiagnostics'
import type { TypeInfo } from '../hooks/useTypeInfo'

type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  onCursorChange?: (offset: number) => void
  language?: 'typescript' | 'javascript' | 'json'
  readOnly?: boolean
  extraLibs?: Record<string, string>
  isMobileLike?: boolean
  className?: string
  fontSizeOverride?: number
  hideGutter?: boolean
  hideTypeInfo?: boolean
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  disableShortcuts?: boolean
  diagnostics?: TSDiagnostic[]
}

export type CodeEditorHandle = {
  undo: () => void
  redo: () => void
  focus: () => void
}

const EDITOR_PADDING_TOP = 8
const DEFAULT_LINE_HEIGHT = 1.5

function getSharedStyles(
  fontSize: number,
  lineHeight: number,
  paddingX: number
): React.CSSProperties {
  return {
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}px`,
    padding: `${EDITOR_PADDING_TOP}px ${paddingX}px`,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    overflowWrap: 'normal',
    fontFamily: 'inherit',
    tabSize: 2,
  }
}

export const CodeEditor = React.memo(
  forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
    const {
      value,
      onChange,
      onCursorChange,
      language = 'typescript',
      readOnly = false,
      extraLibs,
      isMobileLike,
      className,
      fontSizeOverride,
      hideGutter = false,
      hideTypeInfo = false,
      disableAutocomplete = false,
      disableDiagnostics = false,
      disableShortcuts = false,
      diagnostics: externalDiagnostics = [],
    } = props

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textInputRef = useRef<HTMLTextAreaElement>(null)
    const codeDisplayRef = useRef<HTMLPreElement>(null)
    const editorWrapperRef = useRef<HTMLDivElement>(null)
    const lineGutterRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    const [typeInfo, setTypeInfo] = useState<TypeInfo | undefined>()
    const [activeDiagnostic, setActiveDiagnostic] = useState<
      TSDiagnostic | undefined
    >()
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
      any[]
    >([])
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
    const [autocompletePopupPosition, setAutocompletePopupPosition] = useState({
      top: 0,
      left: 0,
    })

    const [selection, setSelection] = useState({ start: 0, end: 0 })
    const [isFocused, setIsFocused] = useState(false)
    const [cursorCoords, setCursorCoords] = useState({ top: 0, left: 0 })

    const baseFontSize = fontSizeOverride || (isMobileLike ? 13 : 14)
    const lineHeight = Math.round(baseFontSize * DEFAULT_LINE_HEIGHT)
    const horizontalPadding = isMobileLike ? 12 : 16

    const typeInfoDebounceTimer = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined)
    const autocompleteDebounceTimer = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined)
    const lastValueRef = useRef(value)

    const linesOfCode = useMemo(() => value.split('\n'), [value])
    const totalContentHeight =
      linesOfCode.length * lineHeight + EDITOR_PADDING_TOP * 2

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (!readOnly) document.execCommand('undo')
      },
      redo: () => {
        if (!readOnly) document.execCommand('redo')
      },
      focus: () => {
        textInputRef.current?.focus()
      },
    }))

    const measureTextWidth = useCallback(
      (text: string) => {
        if (!canvasRef.current)
          canvasRef.current = document.createElement('canvas')
        const context = canvasRef.current.getContext('2d')
        if (context) {
          context.font = `${baseFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
          // Tabs are 2 spaces. We replace them for measurement to match display.
          const processedText = text.replaceAll('\t', '  ')
          return context.measureText(processedText).width
        }
        return 0
      },
      [baseFontSize]
    )

    const updateCursorPosition = useCallback(() => {
      if (!textInputRef.current) return
      const start = textInputRef.current.selectionStart
      const end = textInputRef.current.selectionEnd
      setSelection({ start, end })

      const textBeforeSelection = value.substring(0, start)
      const linesBefore = textBeforeSelection.split('\n')
      const lIdx = linesBefore.length - 1
      const currentLineTextBeforeCursor = linesBefore[lIdx]

      const top = lIdx * lineHeight + EDITOR_PADDING_TOP
      const left =
        measureTextWidth(currentLineTextBeforeCursor) + horizontalPadding

      setCursorCoords({ top, left })
      onCursorChange?.(start)
    }, [value, lineHeight, horizontalPadding, measureTextWidth, onCursorChange])

    useEffect(() => {
      if (value !== lastValueRef.current) {
        updateCursorPosition()
        lastValueRef.current = value
      }
    }, [value, updateCursorPosition])

    useEffect(() => {
      if (!isFocused || !scrollContainerRef.current) return
      const container = scrollContainerRef.current
      const { scrollTop, scrollLeft, clientHeight, clientWidth } = container
      const cursorTop = cursorCoords.top
      const cursorLeft = cursorCoords.left
      const margin = 20
      if (cursorTop < scrollTop + margin)
        container.scrollTop = Math.max(0, cursorTop - margin)
      else if (cursorTop + lineHeight > scrollTop + clientHeight - margin)
        container.scrollTop = cursorTop + lineHeight - clientHeight + margin
      if (cursorLeft < scrollLeft + horizontalPadding + margin)
        container.scrollLeft = Math.max(
          0,
          cursorLeft - horizontalPadding - margin
        )
      else if (cursorLeft > scrollLeft + clientWidth - margin)
        container.scrollLeft = cursorLeft - clientWidth + margin
    }, [cursorCoords, isFocused, lineHeight, horizontalPadding])

    const handleTextInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value
        lastValueRef.current = newVal
        onChange?.(newVal)
      },
      [onChange]
    )

    const requestAutocompleteSuggestions = useCallback(
      async (offset: number) => {
        if (disableAutocomplete || readOnly) return
        if (autocompleteDebounceTimer.current)
          clearTimeout(autocompleteDebounceTimer.current)
        autocompleteDebounceTimer.current = setTimeout(async () => {
          try {
            const results = await workerClient.getCompletions(offset)
            setAutocompleteSuggestions(results || [])
            setSelectedSuggestionIndex(0)
            if (results && results.length > 0)
              setAutocompletePopupPosition({
                top: cursorCoords.top + lineHeight,
                left: cursorCoords.left,
              })
          } catch (e) {
            setAutocompleteSuggestions([])
          }
        }, 80)
      },
      [disableAutocomplete, readOnly, cursorCoords, lineHeight]
    )

    const applyAutocompleteSelection = useCallback(
      (index: number) => {
        const suggestion = autocompleteSuggestions[index]
        if (!suggestion || !textInputRef.current) return
        const textarea = textInputRef.current
        const start = textarea.selectionStart
        const textBefore = value.substring(0, start)
        const lastWordMatch = textBefore.match(/[\w$]+$/)
        const lastWord = lastWordMatch ? lastWordMatch[0] : ''
        const replaceStart = start - lastWord.length
        const newValue =
          value.substring(0, replaceStart) +
          (suggestion.insertText || suggestion.name) +
          value.substring(start)
        lastValueRef.current = newValue
        onChange?.(newValue)
        setAutocompleteSuggestions([])
        setTimeout(() => {
          const newPos =
            replaceStart + (suggestion.insertText || suggestion.name).length
          textarea.setSelectionRange(newPos, newPos)
          textarea.focus()
          updateCursorPosition()
        }, 0)
      },
      [autocompleteSuggestions, value, onChange, updateCursorPosition]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (disableShortcuts) return
        if (autocompleteSuggestions.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedSuggestionIndex(
              (i) => (i + 1) % autocompleteSuggestions.length
            )
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedSuggestionIndex(
              (i) =>
                (i - 1 + autocompleteSuggestions.length) %
                autocompleteSuggestions.length
            )
            return
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            applyAutocompleteSelection(selectedSuggestionIndex)
            return
          }
          if (e.key === 'Escape') {
            setAutocompleteSuggestions([])
            return
          }
        }
        if (e.key === 'Tab' && !readOnly) {
          e.preventDefault()
          const start = e.currentTarget.selectionStart
          const end = e.currentTarget.selectionEnd
          const newValue =
            value.substring(0, start) + '  ' + value.substring(end)
          lastValueRef.current = newValue
          onChange?.(newValue)
          setTimeout(() => {
            if (textInputRef.current) {
              textInputRef.current.setSelectionRange(start + 2, start + 2)
              updateCursorPosition()
            }
          }, 0)
        }
      },
      [
        value,
        onChange,
        readOnly,
        autocompleteSuggestions,
        selectedSuggestionIndex,
        applyAutocompleteSelection,
        disableShortcuts,
        updateCursorPosition,
      ]
    )

    const getTypeInfo = useCallback(
      async (code: string, offset: number) => {
        if (hideTypeInfo) return undefined
        try {
          await workerClient.updateFile('main.ts', code)
          return await workerClient.getTypeInfo(offset)
        } catch {
          return undefined
        }
      },
      [hideTypeInfo]
    )

    const handleCursorMovement = useCallback(() => {
      updateCursorPosition()
      if (!textInputRef.current) return
      const pos = textInputRef.current.selectionStart
      if (typeInfoDebounceTimer.current)
        clearTimeout(typeInfoDebounceTimer.current)
      if (!disableAutocomplete && !readOnly) requestAutocompleteSuggestions(pos)
      typeInfoDebounceTimer.current = setTimeout(async () => {
        const information = hideTypeInfo
          ? undefined
          : await getTypeInfo(value, pos)
        setTypeInfo(information)
        const matchingDiagnostic = disableDiagnostics
          ? undefined
          : externalDiagnostics.find(
              (d) => pos >= d.start && pos <= d.start + d.length
            )
        setActiveDiagnostic(matchingDiagnostic)
      }, 80)
    }, [
      value,
      getTypeInfo,
      externalDiagnostics,
      hideTypeInfo,
      disableDiagnostics,
      disableAutocomplete,
      readOnly,
      requestAutocompleteSuggestions,
      updateCursorPosition,
    ])

    useEffect(() => {
      if (extraLibs && Object.keys(extraLibs).length > 0)
        workerClient.updateExtraLibs(extraLibs)
    }, [extraLibs])
    const handleFocus = useCallback(() => setIsFocused(true), [])
    const handleBlur = useCallback(() => {
      setIsFocused(false)
      setAutocompleteSuggestions([])
    }, [])
    const synchronizeScroll = useCallback(() => {
      if (!scrollContainerRef.current) return
      const { scrollTop, scrollLeft } = scrollContainerRef.current
      if (codeDisplayRef.current)
        codeDisplayRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`
      if (lineGutterRef.current) lineGutterRef.current.scrollTop = scrollTop
    }, [])

    const gutterWidth = useMemo(() => {
      if (hideGutter) return 0
      const digitCount = String(linesOfCode.length).length
      const baseWidth = isMobileLike ? 32 : 44
      return baseWidth + (digitCount - 1) * 8
    }, [linesOfCode.length, isMobileLike, hideGutter])

    const selectionBlocks = useMemo(() => {
      if (selection.start === selection.end || isMobileLike) return []
      const blocks: { top: number; left: number; width: number }[] = []
      const textBeforeSelection = value.substring(0, selection.start)
      const selectedText = value.substring(selection.start, selection.end)
      const startLineIdx = textBeforeSelection.split('\n').length - 1
      const lines = selectedText.split('\n')
      lines.forEach((lineText, i) => {
        const lIdx = startLineIdx + i
        const fullLineText = linesOfCode[lIdx]
        let left = horizontalPadding
        if (i === 0) {
          const startOffsetInLine =
            selection.start -
            (value.substring(0, selection.start).lastIndexOf('\n') + 1)
          const textBeforeInLine = fullLineText.substring(0, startOffsetInLine)
          left += measureTextWidth(textBeforeInLine)
        }
        // We use ' ' as placeholder for empty lines to show selection height
        const width = measureTextWidth(lineText || ' ')
        blocks.push({
          top: lIdx * lineHeight + EDITOR_PADDING_TOP,
          left,
          width,
        })
      })
      return blocks
    }, [
      selection,
      value,
      lineHeight,
      horizontalPadding,
      measureTextWidth,
      linesOfCode,
      isMobileLike,
    ])

    const indentGuides = useMemo(() => {
      const guides: { top: number; left: number; height: number }[] = []
      linesOfCode.forEach((lineText, i) => {
        const match = lineText.match(/^(\s+)/)
        if (match) {
          const spaces = match[1].length
          for (let s = 2; s <= spaces; s += 2) {
            guides.push({
              top: i * lineHeight + EDITOR_PADDING_TOP,
              left: measureTextWidth(' '.repeat(s)) + horizontalPadding,
              height: lineHeight,
            })
          }
        }
      })
      return guides
    }, [linesOfCode, lineHeight, horizontalPadding, measureTextWidth])

    const matchingBrackets = useMemo(() => {
      if (selection.start !== selection.end) return []
      const findPartner = (
        pos: number,
        open: string,
        close: string,
        direction: 1 | -1
      ) => {
        let depth = 0
        for (
          let i = pos;
          direction === 1 ? i < value.length : i >= 0;
          i += direction
        ) {
          if (value[i] === open) depth++
          if (value[i] === close) depth--
          if (depth === 0) return i
        }
        return -1
      }
      const pairs: Record<string, string> = {
        '{': '}',
        '[': ']',
        '(': ')',
        '}': '{',
        ']': '[',
        ')': '(',
      }
      const bracketAt = (pos: number) => {
        const c = value[pos]
        if (!pairs[c]) return null
        const partner = findPartner(
          pos,
          c,
          pairs[c],
          '{[('.includes(c) ? 1 : -1
        )
        if (partner === -1) return null
        return [pos, partner]
      }
      return bracketAt(selection.start) || bracketAt(selection.start - 1) || []
    }, [value, selection])

    // Important: replace tabs with spaces for consistent display across all layers
    const highlightedLines = useMemo(
      () => linesOfCode.map((line) => buildHtml(line.replaceAll('\t', '  '))),
      [linesOfCode]
    )
    const sharedStyles = useMemo(
      () => getSharedStyles(baseFontSize, lineHeight, horizontalPadding),
      [baseFontSize, lineHeight, horizontalPadding]
    )

    const renderBracketHighlight = (pos: number) => {
      const linesBefore = value.substring(0, pos).split('\n')
      const lIdx = linesBefore.length - 1
      const top = lIdx * lineHeight + EDITOR_PADDING_TOP
      const left = measureTextWidth(linesBefore[lIdx]) + horizontalPadding
      const width = measureTextWidth(value[pos])
      return (
        <div
          key={`bracket-${pos}`}
          className='absolute border border-mauve/50 bg-mauve/10 z-0 pointer-events-none'
          style={{ top, left, width, height: lineHeight }}
        />
      )
    }

    return (
      <div
        data-testid='code-editor-container'
        className={cn(
          'code-editor relative w-full h-full overflow-hidden font-mono flex flex-col',
          className
        )}
        onClick={() => textInputRef.current?.focus()}
      >
        <div className='flex-1 relative overflow-hidden min-h-0 bg-base'>
          <div
            ref={scrollContainerRef}
            onScroll={synchronizeScroll}
            className='absolute inset-0 overflow-auto flex'
          >
            {!hideGutter && (
              <div
                ref={lineGutterRef}
                className='shrink-0 overflow-hidden bg-mantle border-r border-surface0 select-none text-overlay0 text-right box-border'
                style={{
                  width: gutterWidth,
                  paddingTop: EDITOR_PADDING_TOP,
                  paddingBottom: EDITOR_PADDING_TOP + (hideTypeInfo ? 0 : 80),
                  fontSize: baseFontSize,
                  lineHeight: `${lineHeight}px`,
                  paddingRight: isMobileLike ? 8 : 12,
                  height: totalContentHeight + (hideTypeInfo ? 0 : 80),
                }}
              >
                {linesOfCode.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: lineHeight,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
            <div
              ref={editorWrapperRef}
              className='flex-1 relative min-w-0'
              style={{
                height: totalContentHeight + (hideTypeInfo ? 0 : 80),
                width: 'max-content',
                minWidth: '100%',
              }}
            >
              {/* Selection Rendering */}
              {!isMobileLike &&
                selectionBlocks.map((b, i) => (
                  <div
                    key={i}
                    className='absolute bg-mauve/20 pointer-events-none'
                    style={{
                      top: b.top,
                      left: b.left,
                      width: b.width,
                      height: lineHeight,
                    }}
                  />
                ))}
              {/* Current Line Highlight */}
              {!readOnly && isFocused && (
                <div
                  className='absolute left-0 right-0 bg-mauve/10 pointer-events-none'
                  style={{
                    top:
                      (value.substring(0, selection.start).split('\n').length -
                        1) *
                        lineHeight +
                      EDITOR_PADDING_TOP,
                    height: lineHeight,
                  }}
                />
              )}
              {/* Indent Guides */}
              {indentGuides.map((g, i) => (
                <div
                  key={i}
                  className='absolute w-[1px] bg-surface1/30 pointer-events-none'
                  style={{ top: g.top, left: g.left, height: g.height }}
                />
              ))}
              {/* Bracket Highlighting */}
              {matchingBrackets.map((pos) => renderBracketHighlight(pos))}
              {/* Display Layer */}
              <pre
                ref={codeDisplayRef}
                data-testid='code-editor-display'
                aria-hidden
                className='text-text bg-transparent pointer-events-none relative z-10'
                style={{ ...sharedStyles, height: totalContentHeight }}
              >
                {highlightedLines.map((html, index) => (
                  <div
                    key={`line-${index}`}
                    style={{ height: lineHeight }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ))}
              </pre>
              {/* Diagnostics Layer */}
              {!disableDiagnostics && (
                <div
                  aria-hidden
                  className='text-transparent bg-transparent pointer-events-none z-10 absolute inset-0'
                  style={{ ...sharedStyles, height: totalContentHeight }}
                >
                  {linesOfCode.map((lineText, index) => {
                    const lineStartOffset =
                      linesOfCode.slice(0, index).join('\n').length +
                      (index > 0 ? 1 : 0)
                    const lineEndOffset = lineStartOffset + lineText.length
                    const lineDiagnostics = externalDiagnostics.filter(
                      (d) =>
                        d.start >= lineStartOffset && d.start < lineEndOffset
                    )
                    const relativeDiagnostics = lineDiagnostics.map((d) => ({
                      ...d,
                      start: d.start - lineStartOffset,
                    }))
                    // Match tab replacement
                    const processedLine = lineText.replaceAll('\t', '  ')
                    return (
                      <div
                        key={`diag-${index}`}
                        style={{ height: lineHeight }}
                        dangerouslySetInnerHTML={{
                          __html: buildSquiggles(
                            processedLine,
                            relativeDiagnostics
                          ),
                        }}
                      />
                    )
                  })}
                </div>
              )}
              {/* Custom Cursor */}
              {!readOnly &&
                isFocused &&
                selection.start === selection.end &&
                !isMobileLike && (
                  <div
                    className='absolute w-[2px] bg-lavender animate-pulse z-30 pointer-events-none'
                    style={{
                      top: cursorCoords.top,
                      left: cursorCoords.left,
                      height: lineHeight,
                    }}
                  />
                )}
              {/* Input Layer */}
              <textarea
                ref={textInputRef}
                data-testid='code-editor-textarea'
                value={value}
                readOnly={readOnly}
                onChange={handleTextInputChange}
                onKeyDown={handleKeyDown}
                onSelect={handleCursorMovement}
                onClick={handleCursorMovement}
                onKeyUp={handleCursorMovement}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onPaste={updateCursorPosition}
                spellCheck={false}
                autoCorrect='off'
                autoCapitalize='off'
                autoComplete='off'
                wrap='off'
                data-gramm='false'
                className={cn(
                  'absolute inset-0 bg-transparent border-none outline-none resize-none z-20',
                  !isMobileLike
                    ? 'caret-transparent selection:bg-transparent'
                    : 'caret-lavender'
                )}
                style={{
                  ...sharedStyles,
                  height: totalContentHeight,
                  width: '100%',
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                }}
              />
              {autocompleteSuggestions.length > 0 && (
                <ul
                  role='listbox'
                  data-testid='autocomplete-listbox'
                  className='hidden md:block absolute m-0 p-0 list-none bg-mantle border border-surface1 rounded-md shadow-lg shadow-black/30 z-50 max-h-52 overflow-y-auto min-w-48 text-sm'
                  style={{
                    top: autocompletePopupPosition.top,
                    left: autocompletePopupPosition.left,
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {autocompleteSuggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.name}
                      role='option'
                      data-testid='autocomplete-option'
                      aria-selected={index === selectedSuggestionIndex}
                      className={`px-3 py-1.5 cursor-pointer flex justify-between gap-4 ${index === selectedSuggestionIndex ? 'bg-surface0 text-text' : 'bg-transparent text-subtext0'}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        applyAutocompleteSelection(index)
                      }}
                    >
                      <span>{suggestion.name}</span>
                      <span className='text-overlay0 text-xs'>
                        {suggestion.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        {!hideTypeInfo && (
          <TypeInfoBar
            typeInfo={typeInfo}
            activeDiag={activeDiagnostic}
            language={language}
            gutterW={gutterWidth}
          />
        )}
      </div>
    )
  })
)
