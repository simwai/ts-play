import { type TypeInfo } from '../lib/types'
import Editor, {
  type BeforeMount,
  type OnMount,
  useMonaco,
} from '@monaco-editor/react'
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

type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  onCursorChange?: (offset: number) => void
  onCursorPosChange?: (pos: { line: number; col: number }) => void
  onTypeInfoChange?: (info: TypeInfo | null) => void
  language?: 'typescript' | 'javascript' | 'json'
  readOnly?: boolean
  hideGutter?: boolean
  fontSizeOverride?: number
  disableAutocomplete?: boolean
  theme?: ThemeMode
  path?: string
  lineWrap?: boolean
  extraLibs?: Record<string, string>
  isMobileLike?: boolean
  hideTypeInfo?: boolean
  disableDiagnostics?: boolean
  disableShortcuts?: boolean
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
  (
    {
      value,
      onChange,
      onCursorChange,
      onCursorPosChange,
      onTypeInfoChange,
      language = 'typescript',
      readOnly = false,
      hideGutter = false,
      fontSizeOverride,
      disableAutocomplete = false,
      theme = 'mocha',
      path = 'file:///index.ts',
      lineWrap = true,
      extraLibs = {},
      isMobileLike = false,
      hideTypeInfo = false,
      disableDiagnostics = false,
      disableShortcuts = false,
    },
    ref
  ) => {
    const editorRef = useRef<any>(null)
    const monaco = useMonaco()
    const typeInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevLibKeysRef = useRef<Set<string>>(new Set())

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
      monaco.editor.defineTheme('github-dark', githubDark as any)
      monaco.editor.defineTheme('github-light', githubLight as any)
      monaco.editor.defineTheme('latte', latte as any)
      monaco.editor.defineTheme('mocha', mocha as any)
      monaco.editor.defineTheme('monokai', monokai as any)
      monaco.editor.defineTheme('shades-of-purple', shadesOfPurple as any)

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        allowJs: true,
        typeRoots: ['node_modules/@types'],
        baseUrl: 'file:///',
        resolveJsonModule: true,
        paths: {
          '*': ['node_modules/*'],
        },
      })
    }

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor

      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (!model) return

        const offset = model.getOffsetAt(e.position)
        onCursorChange?.(offset)
        onCursorPosChange?.({
          line: e.position.lineNumber,
          col: e.position.column,
        })

        if (!onTypeInfoChange || hideTypeInfo) return

        if (typeInfoTimerRef.current) clearTimeout(typeInfoTimerRef.current)
        typeInfoTimerRef.current = setTimeout(async () => {
          try {
            const worker = await monaco.languages.typescript.getTypeScriptWorker()
            const client = await worker(model.uri)
            const info = await client.getQuickInfoAtPosition(
              model.uri.toString(),
              offset
            )

            if (info) {
              const displayParts = info.displayParts || []
              const documentation = info.documentation || []
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
        }, 120)
      })
    }

    useEffect(() => {
      if (monaco) {
        const nextKeys = new Set(Object.keys(extraLibs))
        const hasChanges = nextKeys.size !== prevLibKeysRef.current.size ||
          [...nextKeys].some(k => !prevLibKeysRef.current.has(k))

        if (!hasChanges) return

        prevLibKeysRef.current = nextKeys

        const libs = Object.entries(extraLibs)
          .map(([key, content]) => {
            let filePath = key
            if (!filePath.startsWith('file://')) {
              filePath = `file://${filePath.startsWith('/') ? '' : '/'}${filePath}`
            }
            if (filePath === 'file:///index.d.ts') return null
            return { content, filePath }
          })
          .filter(Boolean)
        monaco.languages.typescript.typescriptDefaults.setExtraLibs(libs as any)
      }
    }, [monaco, extraLibs])

    useEffect(() => {
      if (!monaco) return

      if (language === 'typescript') {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        })
      } else if (language === 'json') {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
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
        domReadOnly: isMobileLike,
        selectionHighlight: !isMobileLike,
        occurrencesHighlight: !isMobileLike,
        links: !isMobileLike,
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

    return (
      <div
        className='w-full h-full relative group'
        style={{
          userSelect: isMobileLike ? 'text' : 'none',
          WebkitUserSelect: isMobileLike ? 'text' : 'none',
        }}
      >
        <Editor
          height='100%'
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme={theme}
          options={options}
          path={path}
        />
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'
