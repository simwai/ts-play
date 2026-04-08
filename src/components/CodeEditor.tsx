import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import Editor, {
  type BeforeMount,
  type OnMount,
  useMonaco,
} from '@monaco-editor/react'
import { type TypeInfo, type ThemeMode } from '../lib/types'
import {
  githubDark,
  githubLight,
  latte,
  mocha,
  monokai,
  shadesOfPurple,
} from '../lib/monaco-themes'

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
  diagnostics?: any[]
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
      theme = 'dark',
      path,
      lineWrap = true,
      extraLibs = {},
      isMobileLike = false,
      hideTypeInfo = false,
      disableDiagnostics = false,
    },
    ref
  ) => {
    const editorRef = useRef<any>(null)
    const monaco = useMonaco() as any
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

      if (language === 'typescript') {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          reactNamespace: 'React',
          allowJs: true,
          typeRoots: ['node_modules/@types'],
        })
      }
    }

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor

      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (!model) return

        onCursorPosChange?.({
          line: e.position.lineNumber,
          col: e.position.column,
        })
        onCursorChange?.(model.getOffsetAt(e.position))

        if (!onTypeInfoChange || hideTypeInfo) return

        if (typeInfoTimerRef.current) clearTimeout(typeInfoTimerRef.current)
        typeInfoTimerRef.current = setTimeout(async () => {
          if (language !== 'typescript') return

          try {
            const worker = await monaco.languages.typescript.getTypeScriptWorker()
            const client = await worker(model.uri)
            const info = await client.getQuickInfoAtPosition(
              model.uri.toString(),
              model.getOffsetAt(e.position)
            )

            if (info) {
              const displayParts = info.displayParts || []
              const documentation = info.documentation || []
              onTypeInfoChange?.({
                name: displayParts.map((p: any) => p.text).join(''),
                kind: info.kind,
                typeAnnotation: displayParts.map((p: any) => p.text).join(''),
                detail: documentation.map((d: any) => d.text).join(''),
              })
            } else {
              onTypeInfoChange?.(null)
            }
          } catch {
            onTypeInfoChange?.(null)
          }
        }, 500)
      })
    }

    useEffect(() => {
      if (monaco && language === 'typescript') {
        const libs = Object.entries(extraLibs).map(([path, content]) => ({
          content,
          filePath: path.startsWith('file://') ? path : `file:///${path}`,
        }))

        const currentKeys = new Set(Object.keys(extraLibs))
        const hasChanged =
          currentKeys.size !== prevLibKeysRef.current.size ||
          [...currentKeys].some((k) => !prevLibKeysRef.current.has(k))

        if (hasChanged) {
          monaco.languages.typescript.typescriptDefaults.setExtraLibs(libs as any)
          prevLibKeysRef.current = currentKeys
        }

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        })
      }

      if (monaco && language === 'json') {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          allowComments: true,
        })
      }
    }, [monaco, extraLibs, language, disableDiagnostics])

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
        occurrencesHighlight: (!isMobileLike ? 'singleFile' : 'off') as any,
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
        className="h-full w-full overflow-hidden"
        data-testid="code-editor-container"
      >
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme={theme === 'dark' ? 'mocha' : 'latte'}
          options={options}
          path={path}
        />
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'
