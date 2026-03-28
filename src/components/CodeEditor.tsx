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
import { buildHtml } from '../lib/editor-utils'
import { TypeInfoBar } from './ui/TypeInfoBar'
import { cn } from '../lib/utils'
import type { TSDiagnostic, TypeInfo } from '../lib/types'

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
  lineWrap?: boolean
}

export type CodeEditorRef = {
  undo: () => void
  redo: () => void
  focus: () => void
}

const EDITOR_PADDING_TOP = 8
const DEFAULT_LINE_HEIGHT = 1.5

export const CodeEditor = React.memo(
  forwardRef<CodeEditorRef, CodeEditorProps>((props, ref) => {
    const {
      value: doc,
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
      lineWrap = false,
    } = props

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textInputRef = useRef<HTMLTextAreaElement>(null)
    const codeDisplayRef = useRef<HTMLPreElement>(null)

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

    const [selection, setSelection] = useState({ anchor: 0, head: 0 })
    const [isFocused, setIsFocused] = useState(false)
    const [cursorCoords, setCursorCoords] = useState({
      top: 0,
      left: 0,
      height: 0,
    })
    const [isComposing, setIsComposing] = useState(false)

    const baseFontSize = fontSizeOverride || (isMobileLike ? 13 : 14)
    const lineHeight = Math.round(baseFontSize * DEFAULT_LINE_HEIGHT)
    const horizontalPadding = isMobileLike ? 12 : 16

    const typeInfoDebounceTimer =
      useRef<ReturnType<typeof setTimeout>>(undefined)
    const autocompleteDebounceTimer =
      useRef<ReturnType<typeof setTimeout>>(undefined)
    const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined)

    const linesOfCode = useMemo(() => doc.split('\n'), [doc])

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

    const cachedSelText = useRef('')

    const syncTextareaFromModelSelection = useCallback(() => {
      if (!textInputRef.current || isComposing) return
      const from = Math.min(selection.anchor, selection.head)
      const to = Math.max(selection.anchor, selection.head)
      const selectedText = doc.slice(from, to)

      cachedSelText.current = selectedText
      textInputRef.current.value = selectedText
      textInputRef.current.setSelectionRange(0, selectedText.length)
    }, [selection, doc, isComposing])

    const applyChangeToDoc = useCallback(
      (from: number, to: number, insert: string) => {
        const newDoc = doc.slice(0, from) + insert + doc.slice(to)
        onChange?.(newDoc)

        const newPos = from + insert.length
        setSelection({ anchor: newPos, head: newPos })
        onCursorChange?.(newPos)
      },
      [doc, onChange, onCursorChange]
    )

    const readFromTextareaIfChanged = useCallback(() => {
      if (!textInputRef.current) return
      const newText = textInputRef.current.value
      const oldText = cachedSelText.current

      if (newText === oldText) return

      let prefix = 0
      const maxPrefix = Math.min(oldText.length, newText.length)
      while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) {
        prefix++
      }

      let suffix = 0
      const maxSuffix = Math.min(
        oldText.length - prefix,
        newText.length - prefix
      )
      while (
        suffix < maxSuffix &&
        oldText[oldText.length - 1 - suffix] ===
          newText[newText.length - 1 - suffix]
      ) {
        suffix++
      }

      const newMiddle = newText.slice(prefix, newText.length - suffix)
      const baseFrom = Math.min(selection.anchor, selection.head)
      const baseTo = Math.max(selection.anchor, selection.head)

      const changeFrom = baseFrom + prefix
      const changeTo = baseTo - suffix

      applyChangeToDoc(changeFrom, changeTo, newMiddle)
    }, [selection, applyChangeToDoc])

    useEffect(() => {
      if (isFocused) {
        syncTextareaFromModelSelection()
      }
    }, [selection, doc, isFocused, syncTextareaFromModelSelection])

    const mapDocIndexToDOM = useCallback((pos: number) => {
      if (!codeDisplayRef.current) return null
      let currentOffset = 0
      let targetNode: Node | null = null
      let targetNodeOffset = 0

      const walk = (node: Node) => {
        if (targetNode) return
        if (node.nodeType === Node.TEXT_NODE) {
          const len = node.textContent?.length || 0
          if (currentOffset + len >= pos) {
            targetNode = node
            targetNodeOffset = pos - currentOffset
          }
          currentOffset += len
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i])
          }
        }
      }

      walk(codeDisplayRef.current)

      if (!targetNode && currentOffset === pos) {
        const findLastTextNode = (node: Node): Node | null => {
          if (node.nodeType === Node.TEXT_NODE) return node
          for (let i = node.childNodes.length - 1; i >= 0; i--) {
            const result = findLastTextNode(node.childNodes[i])
            if (result) return result
          }
          return null
        }
        targetNode = findLastTextNode(codeDisplayRef.current)
        if (targetNode) targetNodeOffset = targetNode.textContent?.length || 0
      }

      return targetNode ? { node: targetNode, offset: targetNodeOffset } : null
    }, [])

    const updateCursorDOM = useCallback(() => {
      if (!isFocused) return
      const domPos = mapDocIndexToDOM(selection.head)
      if (!domPos || !codeDisplayRef.current) {
        setCursorCoords({ top: 0, left: horizontalPadding, height: lineHeight })
        return
      }

      const range = document.createRange()
      try {
        range.setStart(domPos.node, domPos.offset)
        range.setEnd(domPos.node, domPos.offset)
        const rects = range.getClientRects()
        const editorRect = codeDisplayRef.current.getBoundingClientRect()

        if (rects.length > 0) {
          const rect = rects[0]
          setCursorCoords({
            top: rect.top - editorRect.top,
            left: rect.left - editorRect.left,
            height: rect.height || lineHeight,
          })
        }
      } catch (e) {
        console.warn('Failed to measure cursor position', e)
      }
    }, [
      selection.head,
      mapDocIndexToDOM,
      lineHeight,
      horizontalPadding,
      isFocused,
    ])

    useEffect(() => {
      const timer = setTimeout(updateCursorDOM, 0)
      return () => clearTimeout(timer)
    }, [doc, selection.head, updateCursorDOM, lineWrap])

    const startPolling = useCallback(() => {
      if (pollTimer.current) return
      pollTimer.current = setInterval(() => {
        if (!textInputRef.current) return
        const hasSelection =
          textInputRef.current.selectionStart !==
          textInputRef.current.selectionEnd
        if (!hasSelection && !isComposing) {
          readFromTextareaIfChanged()
        }
      }, 50)
    }, [isComposing, readFromTextareaIfChanged])

    const stopPolling = useCallback(() => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = undefined
      }
    }, [])

    useEffect(() => {
      if (isFocused) startPolling()
      else stopPolling()
      return stopPolling
    }, [isFocused, startPolling, stopPolling])

    const handleInput = () => {
      if (!isComposing) readFromTextareaIfChanged()
    }

    const handleCompositionStart = () => setIsComposing(true)
    const handleCompositionEnd = () => {
      setIsComposing(false)
      readFromTextareaIfChanged()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return

      if (e.key === 'ArrowLeft') {
        const newPos = Math.max(0, selection.head - 1)
        setSelection({
          anchor: e.shiftKey ? selection.anchor : newPos,
          head: newPos,
        })
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        const newPos = Math.min(doc.length, selection.head + 1)
        setSelection({
          anchor: e.shiftKey ? selection.anchor : newPos,
          head: newPos,
        })
        e.preventDefault()
      } else if (e.key === 'ArrowUp') {
        const headLines = doc.substring(0, selection.head).split('\n')
        if (headLines.length > 1) {
          const currentLineText = headLines.pop() || ''
          const prevLineText = headLines.pop() || ''
          const col = currentLineText.length
          const targetCol = Math.min(col, prevLineText.length)
          const newPos =
            headLines.join('\n').length +
            (headLines.length > 0 ? 1 : 0) +
            targetCol
          setSelection({
            anchor: e.shiftKey ? selection.anchor : newPos,
            head: newPos,
          })
        } else {
          setSelection({ anchor: e.shiftKey ? selection.anchor : 0, head: 0 })
        }
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        const parts = doc.split('\n')
        const headLines = doc.substring(0, selection.head).split('\n')
        const currentLineIdx = headLines.length - 1
        if (currentLineIdx < parts.length - 1) {
          const currentLineText = headLines.pop() || ''
          const col = currentLineText.length
          const nextLineText = parts[currentLineIdx + 1]
          const targetCol = Math.min(col, nextLineText.length)
          const newPos =
            doc
              .split('\n')
              .slice(0, currentLineIdx + 1)
              .join('\n').length +
            1 +
            targetCol
          setSelection({
            anchor: e.shiftKey ? selection.anchor : newPos,
            head: newPos,
          })
        } else {
          setSelection({
            anchor: e.shiftKey ? selection.anchor : doc.length,
            head: doc.length,
          })
        }
        e.preventDefault()
      } else if (e.key === 'Backspace' && selection.anchor === selection.head) {
        const newPos = Math.max(0, selection.head - 1)
        applyChangeToDoc(newPos, selection.head, '')
        e.preventDefault()
      } else if (e.key === 'Enter') {
        applyChangeToDoc(
          Math.min(selection.anchor, selection.head),
          Math.max(selection.anchor, selection.head),
          '\n'
        )
        e.preventDefault()
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        // Handled by browser undo if we weren't manual but we are...
        // For now, let browser handled undo/redo through the textarea content if possible
      }
    }

    const posAtCoords = useCallback((x: number, y: number) => {
      if (!codeDisplayRef.current) return 0

      let range: Range | null = null
      if ((document as any).caretRangeFromPoint) {
        range = (document as any).caretRangeFromPoint(x, y)
      } else if ((e: any) => e.caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(x, y)
        if (pos) {
          range = document.createRange()
          range.setStart(pos.offsetNode, pos.offset)
          range.setEnd(pos.offsetNode, pos.offset)
        }
      }

      if (range && range.startContainer) {
        let offset = 0
        const walk = (node: Node) => {
          if (node === range?.startContainer) {
            offset += range?.startOffset || 0
            return true
          }
          if (node.nodeType === Node.TEXT_NODE) {
            offset += node.textContent?.length || 0
          } else {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (walk(node.childNodes[i])) return true
            }
          }
          return false
        }
        walk(codeDisplayRef.current)
        return offset
      }

      return 0
    }, [])

    const handleClick = (e: React.MouseEvent) => {
      const pos = posAtCoords(e.clientX, e.clientY)
      setSelection({ anchor: pos, head: pos })
      textInputRef.current?.focus()
    }

    const gutterWidth = useMemo(() => {
      if (hideGutter) return 0
      const digitCount = String(linesOfCode.length).length
      const baseWidth = isMobileLike ? 32 : 44
      return baseWidth + (digitCount - 1) * 8
    }, [linesOfCode.length, isMobileLike, hideGutter])

    const highlightedHtml = useMemo(() => buildHtml(doc), [doc])

    return (
      <div
        data-testid='code-editor-container'
        className={cn(
          'code-editor relative w-full h-full overflow-hidden flex flex-col',
          className
        )}
      >
        <div className='flex-1 relative overflow-hidden min-h-0 bg-base'>
          <div
            ref={scrollContainerRef}
            className='absolute inset-0 overflow-auto'
            onClick={handleClick}
          >
            <div
              className='relative flex items-start min-h-full cursor-text'
              style={{
                width: lineWrap ? '100%' : 'max-content',
                minWidth: '100%',
                paddingTop: EDITOR_PADDING_TOP,
                paddingBottom: hideTypeInfo ? 0 : 80,
              }}
            >
              <textarea
                ref={textInputRef}
                onInput={handleInput}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                spellCheck={false}
                autoCorrect='off'
                autoCapitalize='off'
                autoComplete='off'
                className='fixed top-[-1000px] left-[-1000px] opacity-0'
              />

              {!hideGutter && (
                <div
                  className='shrink-0 bg-mantle border-r border-surface0 select-none text-overlay0 text-right sticky left-0 z-10'
                  style={{
                    width: gutterWidth,
                    fontSize: baseFontSize,
                    lineHeight: `${lineHeight}px`,
                    paddingRight: isMobileLike ? 8 : 12,
                    paddingTop: EDITOR_PADDING_TOP,
                    fontFamily: 'var(--font-mono)',
                    alignSelf: 'stretch',
                  }}
                >
                  {linesOfCode.map((_, i) => (
                    <div
                      key={i}
                      style={{ height: lineHeight }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              )}

              <div className='flex-1 relative min-w-0'>
                <pre
                  ref={codeDisplayRef}
                  className='text-text bg-transparent m-0'
                  style={{
                    fontSize: `${baseFontSize}px`,
                    lineHeight: `${lineHeight}px`,
                    paddingLeft: horizontalPadding,
                    paddingRight: horizontalPadding,
                    whiteSpace: lineWrap ? 'pre-wrap' : 'pre',
                    fontFamily: 'var(--font-mono)',
                    tabSize: 2,
                    minHeight: '100%',
                    pointerEvents: 'none',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightedHtml + (doc.endsWith('\n') ? '\n ' : ''),
                  }}
                />

                {isFocused && (
                  <div
                    className='absolute w-[2px] bg-mauve z-30 pointer-events-none'
                    style={{
                      top: cursorCoords.top,
                      left: cursorCoords.left,
                      height: cursorCoords.height,
                    }}
                  />
                )}
              </div>
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
