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

type CodeEditorProps = {
  value: string
  onChange: (newValue: string) => void
  onCursorChange?: (cursorPosition: number) => void
  language: 'typescript' | 'javascript'
  readOnly?: boolean
  extraLibs?: Record<string, string>
  keyboardOpen?: boolean
  keyboardHeight?: number
  isMobileLike?: boolean
}

export type CodeEditorRef = {
  undo: () => void
  redo: () => void
}

const EDITOR_PADDING_TOP = 16
const EMPTY_LIBRARIES = {}

const getLayerStyle = (
  contentHeight: number,
  fontSize: number,
  lineHeight: number,
  paddingX: number
): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  margin: 0,
  padding: `${EDITOR_PADDING_TOP}px ${paddingX}px`,
  fontSize: fontSize,
  lineHeight: `${lineHeight}px`,
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
    const animationFrameRequest = useRef<number>(0)

    const fontSize = isMobileLike ? 12 : 14
    const lineHeight = isMobileLike ? 20 : 24
    const characterWidth = isMobileLike ? 7.2 : 8.4
    const gutterWidth = isMobileLike ? 36 : 48
    const horizontalPadding = isMobileLike ? 12 : 16

    const { getTypeInfo } = useTypeInfo()
    const [typeInfo, setTypeInfo] = useState<TypeInfo | undefined>(undefined)
    const [renderedLineHeights, setRenderedLineHeights] = useState<number[]>([])
    const diagnostics = useTSDiagnostics(value, language === 'typescript', extraLibs)
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

    const linesOfCode = useMemo(() => value.split('\n'), [value])
    const totalLineCount = linesOfCode.length
    const effectiveLineHeights = useMemo(
      () => renderedLineHeights.length === totalLineCount ? renderedLineHeights : new Array(totalLineCount).fill(lineHeight),
      [renderedLineHeights, totalLineCount, lineHeight]
    )
    const totalContentHeight = useMemo(
      () => effectiveLineHeights.reduce((total, height) => total + height, 0) + EDITOR_PADDING_TOP * 2,
      [effectiveLineHeights]
    )

    const measureLineWrapHeights = useCallback(() => {
      const measurementContainer = heightMeasurementRef.current
      if (!measurementContainer) return

      const nextLineHeights = [...measurementContainer.children].map((lineElement) =>
        Math.max(lineHeight, Math.ceil((lineElement as HTMLElement).getBoundingClientRect().height))
      )

      setRenderedLineHeights((previousHeights) => {
        const isHeightUniform = previousHeights.length === nextLineHeights.length &&
                                previousHeights.every((height, index) => height === nextLineHeights[index])
        return isHeightUniform ? previousHeights : nextLineHeights
      })
    }, [lineHeight])

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
    }, [measureLineWrapHeights])

    useEffect(() => {
      if (codeDisplayRef.current) {
        codeDisplayRef.current.innerHTML = buildHtml(value) + '\n'
      }
    }, [value])

    const synchronizeScroll = useCallback(() => {
      const scroller = scrollContainerRef.current
      if (!scroller) return

      const { scrollTop } = scroller
      if (lineGutterRef.current) lineGutterRef.current.scrollTop = scrollTop
      if (textInputRef.current) textInputRef.current.scrollTop = scrollTop
    }, [])

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
      [language, effectiveLineHeights, lineHeight, horizontalPadding, characterWidth]
    )

    const applyAutocompleteSelection = useCallback(() => {
      const hasNoSuggestions = autocompleteSuggestions.length === 0
      if (hasNoSuggestions) return

      const textArea = textInputRef.current
      if (!textArea) return

      const cursorPosition = textArea.selectionStart
      const textBeforeCursor = value.slice(0, cursorPosition)
      const wordMatch = /[\w$]+$/.exec(textBeforeCursor)
      const lengthOfWordToReplace = wordMatch ? wordMatch[0].length : 0

      const selectedSuggestion = autocompleteSuggestions[selectedSuggestionIndex]
      const textToInsert = selectedSuggestion.insertText || selectedSuggestion.name

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
          requestAutocompleteSuggestions(newValue, cursorPosition)
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
        const information = await getTypeInfo(value, cursorPosition)
        setTypeInfo(information)

        const matchingDiagnostic = diagnostics.find(
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
    ])

    useEffect(
      () => () => {
        if (typeInfoDebounceTimer.current) {
          clearTimeout(typeInfoDebounceTimer.current)
        }
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

    return (
      <div className='relative w-full h-full overflow-hidden flex flex-col font-mono'>
        <div
          ref={scrollContainerRef}
          onScroll={synchronizeScroll}
          className='flex-1 overflow-y-auto overflow-x-hidden flex min-h-0 bg-base overscroll-contain touch-pan-y'
        >
          <div
            ref={lineGutterRef}
            className='shrink-0 overflow-hidden bg-mantle border-r border-surface0 select-none text-overlay0 text-right box-border'
            style={{
              width: gutterWidth,
              paddingTop: EDITOR_PADDING_TOP,
              paddingBottom: EDITOR_PADDING_TOP,
              fontSize: fontSize,
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
          <div
            ref={editorWrapperRef}
            className='flex-1 relative min-w-0'
            style={{ minHeight: totalContentHeight }}
          >
            <div
              ref={heightMeasurementRef}
              aria-hidden
              className='absolute inset-0 invisible pointer-events-none -z-10 box-border whitespace-pre-wrap wrap-break-word'
              style={{
                padding: `${EDITOR_PADDING_TOP}px ${horizontalPadding}px`,
                fontSize: fontSize,
                lineHeight: `${lineHeight}px`,
              }}
            >
              {linesOfCode.map((lineText, index) => (
                <div
                  key={`measure-${index}`}
                  style={{
                    minHeight: lineHeight,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {lineText === '' ? ' ' : lineText.replaceAll('\t', '  ')}
                </div>
              ))}
            </div>
            <pre
              ref={codeDisplayRef}
              aria-hidden
              className='text-text bg-transparent pointer-events-none'
              style={getLayerStyle(totalContentHeight, fontSize, lineHeight, horizontalPadding)}
            />
            <pre
              aria-hidden
              dangerouslySetInnerHTML={{
                __html: buildSquiggles(value, diagnostics),
              }}
              className='text-transparent bg-transparent pointer-events-none z-10'
              style={getLayerStyle(totalContentHeight, fontSize, lineHeight, horizontalPadding)}
            />
            <textarea
              ref={textInputRef}
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
              wrap='soft'
              data-gramm='false'
              data-gramm_editor='false'
              data-enable-grammarly='false'
              className='text-transparent bg-transparent border-none outline-none resize-none z-20 caret-lavender'
              style={{
                ...getLayerStyle(totalContentHeight, fontSize, lineHeight, horizontalPadding),
                height: totalContentHeight,
                WebkitTextFillColor: 'transparent',
                cursor: readOnly ? 'default' : 'text',
                touchAction: 'pan-y',
                caretShape: 'bar',
              }}
            />

            {autocompleteSuggestions.length > 0 && (
              <ul
                role='listbox'
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
                    role='option'
                    aria-selected={index === selectedSuggestionIndex}
                    className={`px-3 py-1.5 cursor-pointer flex justify-between gap-4 ${index === selectedSuggestionIndex ? 'bg-surface0 text-text' : 'bg-transparent text-subtext0'}`}
                    onMouseDown={(mouseDownEvent) => {
                      mouseDownEvent.preventDefault()
                      setSelectedSuggestionIndex(index)
                      applyAutocompleteSelection()
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
        <TypeInfoBar
          typeInfo={typeInfo}
          activeDiag={activeDiagnostic}
          language={language}
          gutterW={gutterWidth}
        />
      </div>
    )
  })
)
