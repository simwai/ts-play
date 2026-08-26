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
}

type DisplayPart = { text: string; kind: string }

// Stable default so the extraLibs effect does not re-run on every render.
const EMPTY_EXTRA_LIBS: Record<string, string> = {}

// Quick-info worker roundtrips are debounced per cursor movement.
const TYPE_INFO_DEBOUNCE_MS = 150

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
      jumpTo: (line, col) => {
        if (editorRef.current) {
          editorRef.current.revealPositionInCenter({
            lineNumber: line,
            column: col,
          })
          editorRef.current.setPosition({ lineNumber: line, column: col })
          editorRef.current.focus()
        }
      },
    }))

    const handleBeforeMount: BeforeMount = (monaco) => {
      monaco.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.typescript.JsxEmit.React,
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      })
      monaco.editor.defineTheme('github-dark', githubDark)
      monaco.editor.defineTheme('github-light', githubLight)
      monaco.editor.defineTheme('latte', latte)
      monaco.editor.defineTheme('mocha', mocha)
      monaco.editor.defineTheme('monokai', monokai)
      monaco.editor.defineTheme('shades-of-purple', shadesOfPurple)
    }

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor as editor.IStandaloneCodeEditor
      const model = editor.getModel()
      if (!model) return

      // Cursor position changes
      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (model) {
          const offset = model.getOffsetAt(e.position)
          onCursorChange?.(offset)
          onCursorPosChange?.({
            line: e.position.lineNumber,
            col: e.position.column,
          })
        }
      })

      // Type info (uses your custom worker via monaco.typescript.getTypeScriptWorker())
      let typeInfoTimer: ReturnType<typeof setTimeout> | null = null
      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (!model || !onTypeInfoChange || hideTypeInfo) return

        if (typeInfoTimer) clearTimeout(typeInfoTimer)
        typeInfoTimer = setTimeout(async () => {
          try {
            const worker = await monaco.typescript.getTypeScriptWorker()
            const client = await worker(model.uri)
            const offset = model.getOffsetAt(e.position)

            const info = await client.getQuickInfoAtPosition(
              model.uri.toString(),
              offset
            )
            if (info) {
              const displayParts = (info.displayParts || []) as DisplayPart[]
              const documentation = (info.documentation || []) as DisplayPart[]
              const text = displayParts.map((p) => p.text).join('')

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
              const symbolPart = displayParts.find((p) =>
                SYMBOL_KINDS.has(p.kind)
              )
              const name = symbolPart ? symbolPart.text : ''

              onTypeInfoChange({
                name,
                kind: info.kind,
                typeAnnotation: text,
                jsDoc: documentation.map((d) => d.text).join('\n'),
              })
            } else {
              onTypeInfoChange(null)
            }
          } catch {
            onTypeInfoChange(null)
          }
        }, TYPE_INFO_DEBOUNCE_MS)
      })

      // Diagnostics reporting (uses Monaco's markers)
      const reportDiagnostics = () => {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        const diags: TSDiagnostic[] = markers.map((m) => ({
          start: m.startColumn,
          length: m.endColumn - m.startColumn,
          message: m.message,
          category:
            m.severity === monaco.MarkerSeverity.Error ? 'error' : 'warning',
          line: m.startLineNumber,
          character: m.startColumn,
        }))
        onDiagnosticsChange?.(diags)
      }

      let throttleTimer: ReturnType<typeof setTimeout> | null = null
      const throttledReport = () => {
        if (throttleTimer) clearTimeout(throttleTimer)
        throttleTimer = setTimeout(reportDiagnostics, 200)
      }

      reportDiagnostics()

      const disposable = monaco.editor.onDidChangeMarkers((uris) => {
        if (uris.some((u) => u.toString() === model.uri.toString())) {
          throttledReport()
        }
      })

      editor.onDidDispose(() => {
        disposable.dispose()
        if (throttleTimer) clearTimeout(throttleTimer)
        if (typeInfoTimer) clearTimeout(typeInfoTimer)
      })
    }

    // Inject extra libs (e.g. ATA typings)
    const lastLibsRef = useRef('')
    useEffect(() => {
      if (monaco) {
        const libs = Object.entries(extraLibs).map(([key, content]) => ({
          content,
          filePath: key.startsWith('file://')
            ? key
            : `file:///${key.startsWith('/') ? key.slice(1) : key}`,
        }))
        const signature = JSON.stringify(libs)
        if (signature === lastLibsRef.current) return
        lastLibsRef.current = signature
        monaco.typescript.typescriptDefaults.setExtraLibs(libs)
      }
    }, [monaco, extraLibs])

    // Toggle diagnostics
    useEffect(() => {
      if (!monaco) return
      if (language === 'typescript' || language === 'javascript') {
        monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        })
      } else if (language === 'json') {
        monaco.json.jsonDefaults.setDiagnosticsOptions({
          validate: !disableDiagnostics,
          allowComments: true,
        })
      }
    }, [monaco, disableDiagnostics, language])

    const options = useMemo(
      () => ({
        minimap: { enabled: false },
        fontSize: fontSizeOverride || (isMobileLike ? 12 : 14),
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
        fontSizeOverride,
        disableAutocomplete,
        lineWrap,
        isMobileLike,
      ]
    )

    const resolvedPath =
      path === 'file:///main.ts' && language === 'javascript'
        ? 'file:///index.js'
        : path === 'file:///main.ts' && language === 'json'
          ? 'file:///tsconfig.json'
          : path

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
