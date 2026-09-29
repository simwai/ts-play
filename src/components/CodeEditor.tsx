import { type TSDiagnostic, type TypeInfo } from '../lib/types'
import Editor, {
  type BeforeMount,
  type OnMount,
  useMonaco,
} from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import {
  githubDark,
  githubLight,
  latte,
  mocha,
  monokai,
  shadesOfPurple,
} from '../lib/monaco-themes'
import { type ThemeMode } from '../lib/theme'

export type CodeEditorRef = {
  undo: () => void
  redo: () => void
  jumpTo: (line: number, col: number) => void
  getValue: () => string
}

const EMPTY_EXTRA_LIBS: Record<string, string> = {}
const TYPE_INFO_DEBOUNCE_MS = 150
const DIAGNOSTICS_THROTTLE_MS = 200

const SYMBOL_KINDS = new Set([
  'localName',
  'variableName',
  'parameterName',
  'methodName',
  'functionName',
  'className',
  'interfaceName',
  'aliasName',
  'propertyName',
  'enumName',
  'enumMemberName',
  'moduleName',
  'typeParameterName',
])

type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  onCursorChange?: (offset: number) => void
  onCursorPosChange?: (pos: { line: number; col: number }) => void
  onTypeInfoChange?: (info: TypeInfo | null) => void
  onDiagnosticsChange?: (diagnostics: TSDiagnostic[]) => void
  language?: 'typescript' | 'javascript' | 'json'
  readOnly?: boolean
  hideGutter?: boolean
  hideTypeInfo?: boolean
  fontSizeOverride?: number
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  themeMode?: ThemeMode
  path?: string
  lineWrap?: boolean
  extraLibs?: Record<string, string>
  isMobileLike?: boolean
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  (
    {
      value,
      onChange,
      onCursorChange,
      onCursorPosChange,
      onTypeInfoChange,
      onDiagnosticsChange,
      language = 'typescript',
      readOnly = false,
      hideGutter = false,
      hideTypeInfo = false,
      fontSizeOverride,
      disableAutocomplete = false,
      disableDiagnostics = false,
      themeMode = 'mocha',
      path = 'file:///main.ts',
      lineWrap = true,
      extraLibs = EMPTY_EXTRA_LIBS,
      isMobileLike = false,
    },
    ref
  ) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const monaco = useMonaco()

    useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
      getValue: () => editorRef.current?.getModel()?.getValue() ?? '',
      jumpTo: (line, col) => {
        const editorInstance = editorRef.current
        if (editorInstance) {
          editorInstance.revealPositionInCenter({
            lineNumber: line,
            column: col,
          })
          editorInstance.setPosition({ lineNumber: line, column: col })
          editorInstance.focus()
        }
      },
    }))

    const handleBeforeMount: BeforeMount = (monacoInstance) => {
      monacoInstance.typescript.typescriptDefaults.setCompilerOptions({
        target: monacoInstance.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monacoInstance.typescript.ModuleResolutionKind.NodeJs,
        module: monacoInstance.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monacoInstance.typescript.JsxEmit.React,
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      })
      monacoInstance.editor.defineTheme('github-dark', githubDark)
      monacoInstance.editor.defineTheme('github-light', githubLight)
      monacoInstance.editor.defineTheme('latte', latte)
      monacoInstance.editor.defineTheme('mocha', mocha)
      monacoInstance.editor.defineTheme('monokai', monokai)
      monacoInstance.editor.defineTheme('shades-of-purple', shadesOfPurple)
    }

    const handleEditorMount: OnMount = (editor, monacoInstance) => {
      editorRef.current = editor as editor.IStandaloneCodeEditor
      const model = editor.getModel()
      const isModelMissing = !model
      if (isModelMissing) return

      editor.onDidChangeCursorPosition((e) => {
        const activeModel = editor.getModel()
        if (activeModel) {
          const offset = activeModel.getOffsetAt(e.position)
          onCursorChange?.(offset)
          onCursorPosChange?.({
            line: e.position.lineNumber,
            col: e.position.column,
          })
        }
      })

      let typeInfoTimer: ReturnType<typeof setTimeout> | null = null
      editor.onDidChangeCursorPosition((e) => {
        const activeModel = editor.getModel()
        const isTypeInfoDisabled = !activeModel || !onTypeInfoChange || hideTypeInfo
        if (isTypeInfoDisabled) return

        if (typeInfoTimer) clearTimeout(typeInfoTimer)
        typeInfoTimer = setTimeout(async () => {
          try {
            const worker = await monacoInstance.typescript.getTypeScriptWorker()
            const client = await worker(activeModel.uri)
            const offset = activeModel.getOffsetAt(e.position)

            const info = await client.getQuickInfoAtPosition(
              activeModel.uri.toString(),
              offset
            )

            const hasQuickInfo = Boolean(info)
            if (hasQuickInfo) {
              const displayParts = (info!.displayParts || []) as {
                text: string
                kind: string
              }[]
              const documentation = (info!.documentation || []) as {
                text: string
              }[]
              const typeText = displayParts.map((part) => part.text).join('')

              const symbolPart = displayParts.find((part) =>
                SYMBOL_KINDS.has(part.kind)
              )
              const symbolName = symbolPart ? symbolPart.text : ''

              onTypeInfoChange({
                name: symbolName,
                kind: info!.kind,
                typeAnnotation: typeText,
                jsDoc: documentation.map((doc) => doc.text).join('\n'),
              })
            } else {
              onTypeInfoChange(null)
            }
          } catch {
            onTypeInfoChange(null)
          }
        }, TYPE_INFO_DEBOUNCE_MS)
      })

      const reportDiagnostics = () => {
        const markers = monacoInstance.editor.getModelMarkers({ resource: model.uri })
        const diagnostics: TSDiagnostic[] = markers.map((marker) => ({
          start: marker.startColumn,
          length: marker.endColumn - marker.startColumn,
          message: marker.message,
          category:
            marker.severity === monacoInstance.MarkerSeverity.Error
              ? 'error'
              : 'warning',
          line: marker.startLineNumber,
          character: marker.startColumn,
        }))
        onDiagnosticsChange?.(diagnostics)
      }

      let throttleTimer: ReturnType<typeof setTimeout> | null = null
      const throttledReport = () => {
        if (throttleTimer) clearTimeout(throttleTimer)
        throttleTimer = setTimeout(reportDiagnostics, DIAGNOSTICS_THROTTLE_MS)
      }

      reportDiagnostics()

      const disposable = monacoInstance.editor.onDidChangeMarkers((uris) => {
        const isCurrentModelAffected = uris.some(
          (uri) => uri.toString() === model.uri.toString()
        )
        if (isCurrentModelAffected) {
          throttledReport()
        }
      })

      editor.onDidDispose(() => {
        disposable.dispose()
        if (throttleTimer) clearTimeout(throttleTimer)
        if (typeInfoTimer) clearTimeout(typeInfoTimer)
      })
    }

    const lastLibsRef = useRef('')
    useEffect(() => {
      if (monaco) {
        const libs = Object.entries(extraLibs).map(([key, content]) => {
          const isFileUri = key.startsWith('file://')
          const isAbsolutePath = key.startsWith('/')
          const normalizedPath = isAbsolutePath ? key.slice(1) : key
          const filePath = isFileUri ? key : `file:///${normalizedPath}`

          return { content, filePath }
        })
        const signature = JSON.stringify(libs)
        const isUnchanged = signature === lastLibsRef.current
        if (isUnchanged) return

        lastLibsRef.current = signature
        monaco.typescript.typescriptDefaults.setExtraLibs(libs)
      }
    }, [monaco, extraLibs])

    useEffect(() => {
      if (!monaco) return
      const isScriptLanguage =
        language === 'typescript' || language === 'javascript'
      const isJsonLanguage = language === 'json'

      if (isScriptLanguage) {
        monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        })
      } else if (isJsonLanguage) {
        monaco.json.jsonDefaults.setDiagnosticsOptions({
          validate: !disableDiagnostics,
          allowComments: true,
        })
      }
    }, [monaco, disableDiagnostics, language])

    const defaultFontSize = isMobileLike ? 12 : 14
    const effectiveFontSize = fontSizeOverride || defaultFontSize

    const options = useMemo(
      () => ({
        minimap: { enabled: false },
        fontSize: effectiveFontSize,
        fontFamily:
          "'JetBrains Mono', 'Victor Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        cursorBlinking: 'smooth' as const,
        cursorSmoothCaretAnimation: 'on' as const,
        smoothScrolling: true,
        contextmenu: !isMobileLike,
        readOnly,
        lineNumbers: hideGutter ? ('off' as const) : ('on' as const),
        glyphMargin: !hideGutter,
        folding: !hideGutter,
        lineDecorationsWidth: hideGutter ? 0 : 10,
        lineNumbersMinChars: hideGutter ? 0 : 3,
        scrollbar: {
          vertical: 'visible' as const,
          horizontal: 'visible' as const,
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        renderLineHighlight: 'all' as const,
        suggestOnTriggerCharacters: !disableAutocomplete,
        hover: { enabled: !isMobileLike },
        wordWrap: lineWrap ? ('on' as const) : ('off' as const),
        padding: { top: 16, bottom: 16 },
        fixedOverflowWidgets: true,
      }),
      [
        readOnly,
        hideGutter,
        effectiveFontSize,
        disableAutocomplete,
        lineWrap,
        isMobileLike,
      ]
    )

    const isDefaultMainTs = path === 'file:///main.ts'
    const getResolvedPath = () => {
      if (isDefaultMainTs && language === 'javascript') return 'file:///index.js'
      if (isDefaultMainTs && language === 'json') return 'file:///tsconfig.json'
      return path
    }

    const resolvedPath = getResolvedPath()

    return (
      <div className='w-full h-full relative group'>
        <Editor
          height='100%'
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme={themeMode}
          options={options}
          path={resolvedPath}
        />
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'
