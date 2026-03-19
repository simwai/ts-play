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
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type CodeEditorProps = {
  value: string
  onChange: (newValue: string) => void
  onCursorChange?: (cursorPosition: number) => void
  language: 'typescript' | 'javascript'
  readOnly?: boolean
  extraLibs?: Record<string, string>
  keyboardOpen?: boolean
  keyboardHeight?: number
  isMobileLike?: boolean
  hideGutter?: boolean
  hideTypeInfo?: boolean
  fontSizeOverride?: number
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  className?: string
  lineWrap?: boolean
}

export type CodeEditorRef = {
  undo: () => void
  redo: () => void
}

const EDITOR_PADDING_TOP = 16
const EMPTY_LIBRARIES = {}

const getSharedStyles = (
  fontSize: number,
  lineHeight: number,
  paddingX: number,
  lineWrap: boolean
): React.CSSProperties => ({
  fontSize: fontSize,
  lineHeight: `${lineHeight}px`,
  fontFamily: 'inherit',
  letterSpacing: '0',
  fontKerning: 'none',
  fontVariantLigatures: 'none',
  textRendering: 'geometricPrecision',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  whiteSpace: lineWrap ? 'pre-wrap' : 'pre',
  wordBreak: lineWrap ? 'break-word' : 'normal',
  overflowWrap: lineWrap ? 'break-word' : 'normal',
  padding: `${EDITOR_PADDING_TOP}px ${paddingX}px`,
  tabSize: 2,
})

const getLayerStyle = (
  contentHeight: number,
  fontSize: number,
  lineHeight: number,
  paddingX: number,
  lineWrap: boolean
): React.CSSProperties => ({
  ...getSharedStyles(fontSize, lineHeight, paddingX, lineWrap),
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  margin: 0,
  overflowY: 'hidden',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  minHeight: contentHeight,
})

export const CodeEditor = React.memo(
  React.forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
    {
      value,
      onChange,
      onCursorChange,
      language,
      readOnly = false,
      extraLibs = EMPTY_LIBRARIES,
      keyboardOpen = false,
      keyboardHeight = 0,
      isMobileLike = false,
      hideGutter = false,
      hideTypeInfo = false,
      fontSizeOverride,
      disableAutocomplete = false,
      disableDiagnostics = false,
      className,
      lineWrap = true,
    },
    componentRef
  ) {
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textInputRef = useRef<HTMLTextAreaElement>(null)
    const codeDisplayRef = useRef<HTMLPreElement>(null)
    const lineGutterRef = useRef<HTMLDivElement>(null)
    const heightMeasurementRef = useRef<HTMLDivElement>(null)
    const editorWrapperRef = useRef<HTMLDivElement>(null)
    const typeInfoDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const autocompleteDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const animationFrameRequest = useRef<number>(0)

    const baseFontSize = fontSizeOverride ?? (isMobileLike ? 12 : 14)
    const lineHeight = Math.round(baseFontSize * 1.7)
    const characterWidth = baseFontSize * 0.6
    const gutterWidth = hideGutter ? 0 : (isMobileLike ? 36 : 48)
    const horizontalPadding = isMobileLike ? 12 : 16

    const { getTypeInfo } = useTypeInfo()
    const [typeInfo, setTypeInfo] = useState<TypeInfo | undefined>(undefined)

    const linesOfCode = useMemo(() => value.split('\n'), [value])
    const totalLineCount = linesOfCode.length

    const [renderedLineHeights, setRenderedLineHeights] = useState<number[]>(() => new Array(totalLineCount).fill(lineHeight))

    // Immediate synchronization of renderedLineHeights array size
    useEffect(() => {
      setRenderedLineHeights((prev) => {
        if (prev.length === totalLineCount) return prev
        const next = new Array(totalLineCount).fill(lineHeight)
        const commonLength = Math.min(prev.length, totalLineCount)
        for (let i = 0; i < commonLength; i++) {
          next[i] = prev[i]
        }
        return next
      })
    }, [totalLineCount, lineHeight])

    const diagnostics = useTSDiagnostics(value, !disableDiagnostics && language === 'typescript', extraLibs)
    const [activeDiagnostic, setActiveDiagnostic] = useState<TSDiagnostic | undefined>(undefined)

    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([])
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
    const [autocompletePopupPosition, setAutocompletePopupPosition] = useState({ top: 0, left: 0 })

    const undoHistoryStack = useRef<Array<{ value: string; cursor: number }>>([])
    const redoHistoryStack = useRef<Array<{ value: string; cursor: number }>>([])
    const lastStateSaveTimestamp = useRef<number>(0)
    const previousCursorPosition = useRef<number>(0)
    const pendingCursorPosition = useRef<number | undefined>(undefined)

    useLayoutEffect(() => {
      const isCursorPositionPending = pendingCursorPosition.current !== undefined && textInputRef.current
      if (isCursorPositionPending) {
        textInputRef.current!.selectionStart = textInputRef.current!.selectionEnd = pendingCursorPosition.current!
        previousCursorPosition.current = pendingCursorPosition.current!
        onCursorChange?.(pendingCursorPosition.current!)
        pendingCursorPosition.current = undefined
      }
    }, [value, onCursorChange])

    const saveEditorState = useCallback(
      (currentValue: string, cursorPosition: number, forceSave = false) => {
        const currentTime = Date.now()
        const shouldSaveNewState = forceSave || currentTime - lastStateSaveTimestamp.current > 500
        if (shouldSaveNewState) {
          undoHistoryStack.current.push({ value: currentValue, cursor: cursorPosition })
          redoHistoryStack.current = []
          lastStateSaveTimestamp.current = currentTime
        }
      },
      []
    )

    const undoLastChange = useCallback(() => {
      const canUndo = undoHistoryStack.current.length > 0
      if (!canUndo) return

      const currentTextArea = textInputRef.current
      redoHistoryStack.current.push({ value, cursor: currentTextArea?.selectionStart || 0 })

      const previousState = undoHistoryStack.current.pop()!
      pendingCursorPosition.current = previousState.cursor
      onChange(previousState.value)
    }, [value, onChange])

    const redoLastUndo = useCallback(() => {
      const canRedo = redoHistoryStack.current.length > 0
      if (!canRedo) return

      const currentTextArea = textInputRef.current
      undoHistoryStack.current.push({ value, cursor: currentTextArea?.selectionStart || 0 })

      const nextState = redoHistoryStack.current.pop()!
      pendingCursorPosition.current = nextState.cursor
      onChange(nextState.value)
    }, [value, onChange])

    useImperativeHandle(
      componentRef,
      () => ({
        undo: undoLastChange,
        redo: redoLastUndo,
      }),
      [undoLastChange, redoLastUndo]
    )

    const effectiveLineHeights = useMemo(
      () => renderedLineHeights.length === totalLineCount ? renderedLineHeights : new Array(totalLineCount).fill(lineHeight),
      [renderedLineHeights, totalLineCount, lineHeight]
    )

    const totalContentHeight = useMemo(
      () => effectiveLineHeights.reduce((total, height) => total + height, 0) + EDITOR_PADDING_TOP * 2,
      [effectiveLineHeights]
    )

    const measureLineWrapHeights = useCallback(() => {
      if (!lineWrap) {
        setRenderedLineHeights(new Array(totalLineCount).fill(lineHeight))
        return
      }

      const measurementContainer = heightMeasurementRef.current
      if (!measurementContainer) return

      const children = Array.from(measurementContainer.children) as HTMLElement[]
      const nextLineHeights = children.map((lineElement) =>
        Math.max(lineHeight, Math.ceil(lineElement.getBoundingClientRect().height))
      )

      setRenderedLineHeights((previousHeights) => {
        const isHeightUniform = previousHeights.length === nextLineHeights.length &&
                                previousHeights.every((height, index) => height === nextLineHeights[index])
        return isHeightUniform ? previousHeights : nextLineHeights
      })
    }, [lineHeight, lineWrap, totalLineCount])

    useLayoutEffect(() => {
      if (!editorWrapperRef.current) return
      const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(animationFrameRequest.current)
        animationFrameRequest.current = requestAnimationFrame(measureLineWrapHeights)
      })
      resizeObserver.observe(editorWrapperRef.current)
      return () => {
        resizeObserver.disconnect()
        cancelAnimationFrame(animationFrameRequest.current)
      }
    }, [measureLineWrapHeights])

    useLayoutEffect(() => {
      cancelAnimationFrame(animationFrameRequest.current)
      animationFrameRequest.current = requestAnimationFrame(measureLineWrapHeights)
    }, [measureLineWrapHeights, lineWrap, value])

    const synchronizeScroll = useCallback(() => {
      const scroller = scrollContainerRef.current
      if (!scroller) return

      const { scrollTop, scrollLeft } = scroller
      if (lineGutterRef.current) lineGutterRef.current.scrollTop = scrollTop
      if (textInputRef.current) {
        textInputRef.current.scrollTop = scrollTop
        textInputRef.current.scrollLeft = scrollLeft
      }
    }, [])

    useEffect(() => {
      synchronizeScroll()
    }, [totalContentHeight, synchronizeScroll])

    const ensureSelectionIsVisible = useCallback(() => {
      const textArea = textInputRef.current
      const scroller = scrollContainerRef.current
      if (!textArea || !scroller) return

      const cursorPosition = textArea.selectionStart
      const textBeforeCursor = value.slice(0, cursorPosition)
      const lineIndexOfCursor = Math.max(0, textBeforeCursor.split('\n').length - 1)

      const cursorVerticalOffset = EDITOR_PADDING_TOP + effectiveLineHeights.slice(0, lineIndexOfCursor).reduce((sum, h) => sum + h, 0)
      const currentLineHeight = effectiveLineHeights[lineIndexOfCursor] ?? lineHeight

      const visibleTop = scroller.scrollTop
      const keyboardInset = keyboardOpen ? Math.min(120, Math.max(0, keyboardHeight * 0.12)) : 0
      const visibleBottom = scroller.scrollTop + scroller.clientHeight - 56 - keyboardInset

      const isAboveVisibleArea = cursorVerticalOffset < visibleTop + 8
      const isBelowVisibleArea = cursorVerticalOffset + currentLineHeight > visibleBottom

      if (isAboveVisibleArea) {
        scroller.scrollTo({ top: Math.max(0, cursorVerticalOffset - 24), behavior: 'smooth' })
      } else if (isBelowVisibleArea) {
        scroller.scrollTo({
          top: Math.max(0, cursorVerticalOffset + currentLineHeight - scroller.clientHeight + 56 + keyboardInset + 24),
          behavior: 'smooth',
        })
      }
    }, [keyboardHeight, keyboardOpen, effectiveLineHeights, value, lineHeight])

    const requestAutocompleteSuggestions = useCallback(
      async (currentCode: string, cursorPosition: number, isExplicitInvocation = false) => {
        if (disableAutocomplete) return
        const isNotTypeScript = language !== 'typescript'
        if (isNotTypeScript) return

        const textBeforeCursor = currentCode.slice(0, cursorPosition)
        const wordMatch = /[\w$]+$/.exec(textBeforeCursor)
        const currentWordPrefix = wordMatch ? wordMatch[0] : ''
        const isAtMemberAccess = textBeforeCursor.endsWith('.')

        const shouldSkipAutocomplete = !isExplicitInvocation && !wordMatch && !isAtMemberAccess
        if (shouldSkipAutocomplete) {
          setAutocompleteSuggestions([])
          return
        }

        await workerClient.updateFile('main.ts', currentCode)

        const suggestionEntries = await workerClient.getCompletions(cursorPosition)
        if (suggestionEntries && suggestionEntries.length > 0) {
          const filteredSuggestions = currentWordPrefix
            ? suggestionEntries.filter((entry) => entry.name.toLowerCase().startsWith(currentWordPrefix.toLowerCase()))
            : suggestionEntries

          const hasValidSuggestions = filteredSuggestions.length > 0
          if (hasValidSuggestions) {
            const lineIndexOfCursor = Math.max(0, textBeforeCursor.split('\n').length - 1)
            const popupTop = EDITOR_PADDING_TOP + effectiveLineHeights.slice(0, lineIndexOfCursor).reduce((sum, h) => sum + h, 0) + (effectiveLineHeights[lineIndexOfCursor] ?? lineHeight)
            const currentLineText = textBeforeCursor.split('\n').pop() || ''
            const popupLeft = horizontalPadding + (currentLineText.length - currentWordPrefix.length) * characterWidth

            setAutocompletePopupPosition({ top: popupTop, left: popupLeft })
            setAutocompleteSuggestions(filteredSuggestions.slice(0, 50))
            setSelectedSuggestionIndex(0)
          } else {
            setAutocompleteSuggestions([])
          }
        } else {
          setAutocompleteSuggestions([])
        }
      },
      [language, effectiveLineHeights, lineHeight, horizontalPadding, characterWidth, disableAutocomplete]
    )

    const applyAutocompleteSelection = useCallback((indexOverride?: number) => {
      const index = typeof indexOverride === "number" ? indexOverride : selectedSuggestionIndex
      const suggestion = autocompleteSuggestions[index]
      if (!suggestion) return

      const textArea = textInputRef.current
      if (!textArea) return

      const cursorPosition = textArea.selectionStart
      const textBeforeCursor = value.slice(0, cursorPosition)
      const wordMatch = /[\w$]+$/.exec(textBeforeCursor)
      const lengthOfWordToReplace = wordMatch ? wordMatch[0].length : 0

      const textToInsert = suggestion.insertText || suggestion.name

      saveEditorState(value, cursorPosition, true)
      const updatedCode = value.slice(0, cursorPosition - lengthOfWordToReplace) + textToInsert + value.slice(cursorPosition)

      pendingCursorPosition.current = cursorPosition - lengthOfWordToReplace + textToInsert.length
      onChange(updatedCode)
      setAutocompleteSuggestions([])
    }, [autocompleteSuggestions, selectedSuggestionIndex, value, onChange, saveEditorState])

    const handleKeyDown = useCallback(
      (keyEvent: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isAutocompleteActive = autocompleteSuggestions.length > 0
        if (isAutocompleteActive) {
          if (keyEvent.key === 'ArrowDown') {
            keyEvent.preventDefault()
            setSelectedSuggestionIndex((currentIndex) => Math.min(currentIndex + 1, autocompleteSuggestions.length - 1))
            return
          }

          if (keyEvent.key === 'ArrowUp') {
            keyEvent.preventDefault()
            setSelectedSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0))
            return
          }

          if (keyEvent.key === 'Enter' || keyEvent.key === 'Tab') {
            keyEvent.preventDefault()
            applyAutocompleteSelection()
            return
          }

          if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault()
            setAutocompleteSuggestions([])
            return
          }
        }

        const isAutocompleteShortcut = (keyEvent.ctrlKey || keyEvent.metaKey) && (keyEvent.key === ' ' || keyEvent.code === 'Space')
        if (isAutocompleteShortcut) {
          keyEvent.preventDefault()
          requestAutocompleteSuggestions(value, keyEvent.currentTarget.selectionStart, true)
          return
        }

        const isUndoShortcut = (keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key.toLowerCase() === 'z'
        if (isUndoShortcut) {
          keyEvent.preventDefault()
          if (keyEvent.shiftKey) redoLastUndo()
          else undoLastChange()
          return
        }

        const isRedoShortcut = (keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key.toLowerCase() === 'y'
        if (isRedoShortcut) {
          keyEvent.preventDefault()
          redoLastUndo()
          return
        }

        const isTabKey = keyEvent.key === 'Tab'
        if (isTabKey) {
          keyEvent.preventDefault()
          const textArea = keyEvent.currentTarget
          const selectionStart = textArea.selectionStart
          const selectionEnd = textArea.selectionEnd
          saveEditorState(value, selectionStart, true)
          const updatedCode = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)

          pendingCursorPosition.current = selectionStart + 2
          onChange(updatedCode)
        }
      },
      [
        value,
        onChange,
        undoLastChange,
        redoLastUndo,
        saveEditorState,
        autocompleteSuggestions,
        applyAutocompleteSelection,
        requestAutocompleteSuggestions,
      ]
    )

    const handleTextInputChange = useCallback(
      (changeEvent: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = changeEvent.target.value
        const cursorPosition = changeEvent.target.selectionStart
        const isBulkEdit = Math.abs(newValue.length - value.length) > 1

        saveEditorState(value, previousCursorPosition.current, isBulkEdit)
        onChange(newValue)
        previousCursorPosition.current = cursorPosition
        onCursorChange?.(cursorPosition)

        if (isBulkEdit) {
          setAutocompleteSuggestions([])
        } else {
          if (autocompleteDebounceTimer.current) clearTimeout(autocompleteDebounceTimer.current)
          autocompleteDebounceTimer.current = setTimeout(() => {
            requestAutocompleteSuggestions(newValue, cursorPosition)
          }, 50)
        }
      },
      [value, onChange, saveEditorState, requestAutocompleteSuggestions, onCursorChange]
    )

    const handleCursorMovement = useCallback(() => {
      const textArea = textInputRef.current
      if (!textArea) return

      const cursorPosition = textArea.selectionStart
      const hasCursorMoved = previousCursorPosition.current !== cursorPosition
      if (hasCursorMoved) {
        previousCursorPosition.current = cursorPosition
        onCursorChange?.(cursorPosition)
      }

      if (typeInfoDebounceTimer.current) {
        clearTimeout(typeInfoDebounceTimer.current)
      }

      typeInfoDebounceTimer.current = setTimeout(async () => {
        const information = hideTypeInfo ? undefined : await getTypeInfo(value, cursorPosition)
        setTypeInfo(information)

        const matchingDiagnostic = disableDiagnostics ? undefined : diagnostics.find(
          (diagnostic) => cursorPosition >= diagnostic.start && cursorPosition <= diagnostic.start + diagnostic.length
        )
        setActiveDiagnostic(matchingDiagnostic)
        ensureSelectionIsVisible()
      }, 80)
    }, [
      value,
      getTypeInfo,
      diagnostics,
      ensureSelectionIsVisible,
      onCursorChange,
      hideTypeInfo,
      disableDiagnostics
    ])

    useEffect(
      () => () => {
        if (typeInfoDebounceTimer.current) clearTimeout(typeInfoDebounceTimer.current)
        if (autocompleteDebounceTimer.current) clearTimeout(autocompleteDebounceTimer.current)
      },
      []
    )

    const preventTouchPropagation = useCallback((touchEvent: React.TouchEvent) => {
      touchEvent.stopPropagation()
    }, [])

    const handleEditorBlur = useCallback(() => {
      setAutocompleteSuggestions([])
    }, [])

    useEffect(() => {
      const shouldScrollOnKeyboardOpen = keyboardOpen && !readOnly
      if (!shouldScrollOnKeyboardOpen) return

      const scrollTimeoutId = globalThis.setTimeout(() => {
        ensureSelectionIsVisible()
      }, 50)

      return () => {
        globalThis.clearTimeout(scrollTimeoutId)
      }
    }, [keyboardOpen, readOnly, ensureSelectionIsVisible])

    const gutterListItems = useMemo(
      () => linesOfCode.map((_, index) => ({
        lineNumber: index + 1,
        lineHeight: effectiveLineHeights[index],
      })),
      [linesOfCode, effectiveLineHeights]
    )

    const highlightedLines = useMemo(() => {
      return linesOfCode.map(line => buildHtml(line) + '\n')
    }, [linesOfCode])

    const extraBottomPadding = hideTypeInfo ? 0 : 80
    const sharedStyles = useMemo(() => getSharedStyles(baseFontSize, lineHeight, horizontalPadding, lineWrap), [baseFontSize, lineHeight, horizontalPadding, lineWrap])
    const layerStyle = useMemo(() => getLayerStyle(totalContentHeight, baseFontSize, lineHeight, horizontalPadding, lineWrap), [totalContentHeight, baseFontSize, lineHeight, horizontalPadding, lineWrap])

    return (
      <div data-testid="code-editor-container" className={cn('code-editor relative w-full h-full overflow-hidden font-mono flex flex-col', className)}>
        <div
          className='flex-1 relative overflow-hidden min-h-0 bg-base'
        >
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
                width: lineWrap ? '100%' : 'max-content'
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
                    style={{
                      minHeight: lineHeight,
                    }}
                  >
                    {lineText === '' ? ' ' : lineText.replaceAll('\t', '  ')}
                  </div>
                ))}
              </div>

              {/* Display Layer (Highlighted Code) */}
              <pre
                ref={codeDisplayRef} data-testid="code-editor-display"
                aria-hidden
                className='text-text bg-transparent pointer-events-none'
                style={layerStyle}
              >
                {highlightedLines.map((html, index) => (
                   <div
                     key={`line-${index}`}
                     style={{ height: effectiveLineHeights[index] || lineHeight }}
                     dangerouslySetInnerHTML={{ __html: html }}
                   />
                ))}
              </pre>

              {/* Diagnostics Layer (Squiggles) */}
              {!disableDiagnostics && (
                <div
                  aria-hidden
                  className='text-transparent bg-transparent pointer-events-none z-10 absolute inset-0'
                  style={layerStyle}
                >
                   {linesOfCode.map((lineText, index) => {
                      const lineStartOffset = linesOfCode.slice(0, index).join('\n').length + (index > 0 ? 1 : 0)
                      const lineEndOffset = lineStartOffset + lineText.length
                      const lineDiagnostics = diagnostics.filter(d => d.start >= lineStartOffset && d.start < lineEndOffset)
                      const relativeDiagnostics = lineDiagnostics.map(d => ({ ...d, start: d.start - lineStartOffset }))

                      return (
                        <div
                          key={`diag-${index}`}
                          style={{ height: effectiveLineHeights[index] || lineHeight }}
                          dangerouslySetInnerHTML={{ __html: buildSquiggles(lineText, relativeDiagnostics) + '\n' }}
                        />
                      )
                   })}
                </div>
              )}

              {/* Input Layer */}
              <textarea
                ref={textInputRef} data-testid="code-editor-textarea"
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
                  role='listbox' data-testid="autocomplete-listbox"
                  aria-label='Autocomplete suggestions'
                  className='hidden md:block absolute m-0 p-0 list-none bg-mantle border border-surface1 rounded-md shadow-lg shadow-black/30 z-50 max-h-52 overflow-y-auto min-w-48 text-sm'
                  style={{
                    top: autocompletePopupPosition.top,
                    left: autocompletePopupPosition.left,
                  }}
                  onMouseDown={(mouseDownEvent) => {
                    mouseDownEvent.preventDefault()
                  }}
                >
                  {autocompleteSuggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.name}
                      role='option' data-testid="autocomplete-option"
                      aria-selected={index === selectedSuggestionIndex}
                      className={`px-3 py-1.5 cursor-pointer flex justify-between gap-4 ${index === selectedSuggestionIndex ? 'bg-surface0 text-text' : 'bg-transparent text-subtext0'}`}
                      onMouseDown={(mouseDownEvent) => {
                        mouseDownEvent.preventDefault()
                        applyAutocompleteSelection(index)
                      }}
                    >
                      <span>{suggestion.name}</span>
                      <span className='text-overlay0 text-xs'>{suggestion.kind}</span>
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
