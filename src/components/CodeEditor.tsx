import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
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
  keyboardOpen?: boolean
  keyboardHeight?: number
  isMobileLike?: boolean
  lineWrap?: boolean
  className?: string
  fontSizeOverride?: number
  hideGutter?: boolean
  hideTypeInfo?: boolean
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  disableShortcuts?: boolean
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
  paddingX: number,
  lineWrap: boolean
): React.CSSProperties {
  return {
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}px`,
    padding: `${EDITOR_PADDING_TOP}px ${paddingX}px`,
    whiteSpace: lineWrap ? 'pre-wrap' : 'pre',
    wordBreak: lineWrap ? 'break-word' : 'normal',
    overflowWrap: lineWrap ? 'break-word' : 'normal',
    fontFamily: 'inherit',
    tabSize: 2,
  }
}

function getLayerStyle(
  height: number,
  fontSize: number,
  lineHeight: number,
  paddingX: number,
  lineWrap: boolean
): React.CSSProperties {
  return {
    ...getSharedStyles(fontSize, lineHeight, paddingX, lineWrap),
    position: 'absolute',
    top: 0,
    left: 0,
    margin: 0,
    border: 'none',
    width: '100%',
    minHeight: height,
    pointerEvents: 'none',
    boxSizing: 'border-box',
    display: 'block',
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
      keyboardOpen,
      keyboardHeight,
      isMobileLike,
      lineWrap = false,
      className,
      fontSizeOverride,
      hideGutter = false,
      hideTypeInfo = false,
      disableAutocomplete = false,
      disableDiagnostics = false,
      disableShortcuts = false,
    } = props

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textInputRef = useRef<HTMLTextAreaElement>(null)
    const codeDisplayRef = useRef<HTMLPreElement>(null)
    const editorWrapperRef = useRef<HTMLDivElement>(null)
    const heightMeasurementRef = useRef<HTMLDivElement>(null)
    const lineGutterRef = useRef<HTMLDivElement>(null)

    const [diagnostics, setDiagnostics] = useState<TSDiagnostic[]>([])
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
    const [effectiveLineHeights, setEffectiveLineHeights] = useState<number[]>(
      []
    )
    const [totalContentHeight, setTotalContentHeight] = useState(0)
    const [gutterWidth, setGutterWidth] = useState(0)

    const baseFontSize = fontSizeOverride || (isMobileLike ? 13 : 14)
    const lineHeight = Math.round(baseFontSize * DEFAULT_LINE_HEIGHT)
    const horizontalPadding = isMobileLike ? 12 : 16

    const typeInfoDebounceTimer = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined)
    const autocompleteDebounceTimer = useRef<
      ReturnType<typeof setTimeout> | undefined
    >(undefined)

    const linesOfCode = useMemo(() => value.split('\n'), [value])

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

    const synchronizeScroll = useCallback(() => {
      if (!scrollContainerRef.current) return
      const { scrollTop, scrollLeft } = scrollContainerRef.current
      if (codeDisplayRef.current)
        codeDisplayRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`
      if (lineGutterRef.current) lineGutterRef.current.scrollTop = scrollTop
    }, [])

    const measureLineWrapHeights = useCallback(() => {
      if (!heightMeasurementRef.current || !lineWrap) {
        setEffectiveLineHeights(new Array(linesOfCode.length).fill(lineHeight))
        return
      }
      const measureContainer = heightMeasurementRef.current
      const lineDivs = Array.from(measureContainer.children) as HTMLDivElement[]
      const heights = lineDivs.map((div) =>
        Math.max(div.getBoundingClientRect().height, lineHeight)
      )
      setEffectiveLineHeights(heights)
    }, [linesOfCode.length, lineHeight, lineWrap])

    useLayoutEffect(() => {
      measureLineWrapHeights()
    }, [value, lineWrap, measureLineWrapHeights, isMobileLike, baseFontSize])

    useEffect(() => {
      const total =
        effectiveLineHeights.reduce((acc, h) => acc + h, 0) +
        EDITOR_PADDING_TOP * 2
      setTotalContentHeight(total)
    }, [effectiveLineHeights])

    useEffect(() => {
      if (hideGutter) {
        setGutterWidth(0)
        return
      }
      const digitCount = String(linesOfCode.length).length
      const baseWidth = isMobileLike ? 32 : 44
      setGutterWidth(baseWidth + (digitCount - 1) * 8)
    }, [linesOfCode.length, isMobileLike, hideGutter])

    const handleTextInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        onChange?.(newValue)
      },
      [onChange]
    )

    const getCursorCoordinates = useCallback(() => {
      if (!textInputRef.current) return { top: 0, left: 0 }
      const textarea = textInputRef.current
      const selectionStart = textarea.selectionStart
      const textBefore = value.substring(0, selectionStart)
      const lines = textBefore.split('\n')
      const currentLineIndex = lines.length - 1

      let top =
        lines
          .slice(0, currentLineIndex)
          .reduce(
            (acc, _, i) => acc + (effectiveLineHeights[i] || lineHeight),
            0
          ) + EDITOR_PADDING_TOP

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        context.font = `${baseFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
        const left =
          context.measureText(lines[currentLineIndex]).width + horizontalPadding
        return { top: top + lineHeight, left }
      }
      return { top: 0, left: 0 }
    }, [
      value,
      effectiveLineHeights,
      lineHeight,
      baseFontSize,
      horizontalPadding,
    ])

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
            if (results && results.length > 0) {
              setAutocompletePopupPosition(getCursorCoordinates())
            }
          } catch (e) {
            setAutocompleteSuggestions([])
          }
        }, 50)
      },
      [disableAutocomplete, readOnly, getCursorCoordinates]
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
        onChange?.(newValue)

        setAutocompleteSuggestions([])

        setTimeout(() => {
          const newPos =
            replaceStart + (suggestion.insertText || suggestion.name).length
          textarea.setSelectionRange(newPos, newPos)
          textarea.focus()
        }, 0)
      },
      [autocompleteSuggestions, value, onChange]
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
          onChange?.(newValue)
          setTimeout(() => {
            if (textInputRef.current) {
              textInputRef.current.setSelectionRange(start + 2, start + 2)
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

    useEffect(() => {
      if (extraLibs && Object.keys(extraLibs).length > 0) {
        workerClient.updateExtraLibs(extraLibs)
      }
    }, [extraLibs])

    const handleCursorMovement = useCallback(() => {
      if (!textInputRef.current) return
      const cursorPosition = textInputRef.current.selectionStart
      onCursorChange?.(cursorPosition)

      if (typeInfoDebounceTimer.current)
        clearTimeout(typeInfoDebounceTimer.current)

      if (!disableAutocomplete && !readOnly) {
        requestAutocompleteSuggestions(cursorPosition)
      }

      typeInfoDebounceTimer.current = setTimeout(async () => {
        const information = hideTypeInfo
          ? undefined
          : await getTypeInfo(value, cursorPosition)
        setTypeInfo(information)

        const matchingDiagnostic = disableDiagnostics
          ? undefined
          : diagnostics.find(
              (diagnostic) =>
                cursorPosition >= diagnostic.start &&
                cursorPosition <= diagnostic.start + diagnostic.length
            )
        setActiveDiagnostic(matchingDiagnostic)
      }, 80)
    }, [
      value,
      getTypeInfo,
      diagnostics,
      onCursorChange,
      hideTypeInfo,
      disableDiagnostics,
      disableAutocomplete,
      readOnly,
      requestAutocompleteSuggestions,
    ])

    useEffect(
      () => () => {
        if (typeInfoDebounceTimer.current)
          clearTimeout(typeInfoDebounceTimer.current)
        if (autocompleteDebounceTimer.current)
          clearTimeout(autocompleteDebounceTimer.current)
      },
      []
    )

    const preventTouchPropagation = useCallback(
      (touchEvent: React.TouchEvent) => {
        touchEvent.stopPropagation()
      },
      []
    )

    const handleEditorBlur = useCallback(() => {
      setAutocompleteSuggestions([])
    }, [])

    const gutterListItems = useMemo(
      () =>
        linesOfCode.map((_, index) => ({
          lineNumber: index + 1,
          lineHeight: effectiveLineHeights[index],
        })),
      [linesOfCode, effectiveLineHeights]
    )

    const highlightedLines = useMemo(() => {
      return linesOfCode.map((line) => buildHtml(line) + '\n')
    }, [linesOfCode])

    const extraBottomPadding = hideTypeInfo ? 0 : 80
    const sharedStyles = useMemo(
      () =>
        getSharedStyles(baseFontSize, lineHeight, horizontalPadding, lineWrap),
      [baseFontSize, lineHeight, horizontalPadding, lineWrap]
    )
    const layerStyle = useMemo(
      () =>
        getLayerStyle(
          totalContentHeight,
          baseFontSize,
          lineHeight,
          horizontalPadding,
          lineWrap
        ),
      [
        totalContentHeight,
        baseFontSize,
        lineHeight,
        horizontalPadding,
        lineWrap,
      ]
    )

    return (
      <div
        data-testid='code-editor-container'
        className={cn(
          'code-editor relative w-full h-full overflow-hidden font-mono flex flex-col',
          className
        )}
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
                  paddingBottom: EDITOR_PADDING_TOP + extraBottomPadding,
                  fontSize: baseFontSize,
                  lineHeight: `${lineHeight}px`,
                  paddingRight: isMobileLike ? 8 : 12,
                  minHeight: totalContentHeight,
                }}
              >
                {gutterListItems.map(({ lineNumber, lineHeight }) => (
                  <div
                    key={lineNumber}
                    style={{
                      height: lineHeight,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {lineNumber}
                  </div>
                ))}
              </div>
            )}
            <div
              ref={editorWrapperRef}
              className='flex-1 relative min-w-0'
              style={{
                minHeight: totalContentHeight + extraBottomPadding,
                width: lineWrap ? '100%' : 'max-content',
              }}
            >
              {/* Measurement Layer */}
              <div
                ref={heightMeasurementRef}
                aria-hidden
                className='absolute inset-0 invisible pointer-events-none -z-10 box-border'
                style={sharedStyles}
              >
                {linesOfCode.map((lineText, index) => (
                  <div
                    key={`measure-${index}`}
                    style={{ minHeight: lineHeight }}
                  >
                    {lineText === '' ? ' ' : lineText.replaceAll('\t', '  ')}
                  </div>
                ))}
              </div>

              {/* Display Layer */}
              <pre
                ref={codeDisplayRef}
                data-testid='code-editor-display'
                aria-hidden
                className='text-text bg-transparent pointer-events-none'
                style={layerStyle}
              >
                {highlightedLines.map((html, index) => (
                  <div
                    key={`line-${index}`}
                    style={{
                      height: effectiveLineHeights[index] || lineHeight,
                    }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ))}
              </pre>

              {/* Diagnostics Layer */}
              {!disableDiagnostics && (
                <div
                  aria-hidden
                  className='text-transparent bg-transparent pointer-events-none z-10 absolute inset-0'
                  style={layerStyle}
                >
                  {linesOfCode.map((lineText, index) => {
                    const lineStartOffset =
                      linesOfCode.slice(0, index).join('\n').length +
                      (index > 0 ? 1 : 0)
                    const lineEndOffset = lineStartOffset + lineText.length
                    const lineDiagnostics = diagnostics.filter(
                      (d) =>
                        d.start >= lineStartOffset && d.start < lineEndOffset
                    )
                    const relativeDiagnostics = lineDiagnostics.map((d) => ({
                      ...d,
                      start: d.start - lineStartOffset,
                    }))

                    return (
                      <div
                        key={`diag-${index}`}
                        style={{
                          height: effectiveLineHeights[index] || lineHeight,
                        }}
                        dangerouslySetInnerHTML={{
                          __html:
                            buildSquiggles(lineText, relativeDiagnostics) +
                            '\n',
                        }}
                      />
                    )
                  })}
                </div>
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
                onTouchStart={preventTouchPropagation}
                onBlur={handleEditorBlur}
                spellCheck={false}
                autoCorrect='off'
                autoCapitalize='off'
                autoComplete='off'
                wrap={lineWrap ? 'soft' : 'off'}
                data-gramm='false'
                data-gramm_editor='false'
                data-enable-grammarly='false'
                className='bg-transparent border-none outline-none resize-none z-20 caret-lavender'
                style={{
                  ...layerStyle,
                  height: totalContentHeight,
                  width: lineWrap ? '100%' : 'max-content',
                  color: 'transparent',
                  WebkitTextFillColor: 'transparent',
                  cursor: readOnly ? 'default' : 'text',
                  touchAction: 'pan-y',
                  caretShape: 'bar',
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
