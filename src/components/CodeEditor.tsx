import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import Editor, {
  type BeforeMount,
  type OnMount,
  useMonaco,
} from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { type TypeInfo, type ThemeMode, type TSDiagnostic } from '../lib/types'
import {
  githubDark,
  githubLight,
  latte,
  mocha,
  monokai,
  shadesOfPurple,
} from '../lib/monaco-themes'
import { useMonacoTypeInfo } from '../hooks/useMonacoTypeInfo'
import { useMonacoAutocomplete } from '../hooks/useMonacoAutocomplete'

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
  diagnostics?: TSDiagnostic[]
  autoImports?: boolean
  customAutocomplete?: boolean
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
      autoImports = false,
      customAutocomplete = false,
    },
    ref
  ) => {
    const [editorInstance, setEditorInstance] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const monaco = useMonaco()
    const prevLibKeysRef = useRef<Set<string>>(new Set())

    useImperativeHandle(ref, () => ({
      undo: () => editorInstance?.trigger('keyboard', 'undo', null),
      redo: () => editorInstance?.trigger('keyboard', 'redo', null),
      jumpTo: (line, col) => {
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

    // Sub-hooks to handle specialized logic (SRP)
    useMonacoTypeInfo(editorInstance, monaco, language, hideTypeInfo, onTypeInfoChange)
    useMonacoAutocomplete(monaco, language, customAutocomplete)

    const handleBeforeMount: BeforeMount = (monaco) => {
      monaco.editor.defineTheme('github-dark', githubDark as any)
      monaco.editor.defineTheme('github-light', githubLight as any)
      monaco.editor.defineTheme('latte', latte as any)
      monaco.editor.defineTheme('mocha', mocha as any)
      monaco.editor.defineTheme('monokai', monokai as any)
      monaco.editor.defineTheme('shades-of-purple', shadesOfPurple as any)

      if (language === 'typescript') {
        const ts = (monaco.languages as any).typescript
        ts.typescriptDefaults.setCompilerOptions({
          target: ts.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: (monaco.languages as any).typescript.ModuleResolutionKind.NodeJs,
          module: (monaco.languages as any).typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: (monaco.languages as any).typescript.JsxEmit.ReactJSX,
          reactNamespace: 'React',
          allowJs: true,
          typeRoots: ['node_modules/@types'],
        })
      }
    }

    const handleEditorMount: OnMount = (editor) => {
      setEditorInstance(editor)

      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (!model) return

        onCursorPosChange?.({
          line: e.position.lineNumber,
          col: e.position.column,
        })

        onCursorChange?.(model.getOffsetAt(e.position))
      })
    }

    useEffect(() => {
      if (monaco && language === 'typescript') {
        const ts = (monaco.languages as any).typescript
        const libs = Object.entries(extraLibs).map(([path, content]) => ({
          content,
          filePath: path.startsWith('file://') ? path : `file:///${path}`,
        }))

        const currentKeys = new Set(Object.keys(extraLibs))
        const hasChanged =
          currentKeys.size !== prevLibKeysRef.current.size ||
          [...currentKeys].some((k) => !prevLibKeysRef.current.has(k))

        if (hasChanged) {
          ts.typescriptDefaults.setExtraLibs(libs)
          prevLibKeysRef.current = currentKeys
        }

        ts.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        })
      }

      if (monaco && language === 'json') {
        (monaco.languages as any).json.jsonDefaults.setDiagnosticsOptions({
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
        occurrencesHighlight: (!isMobileLike ? 'singleFile' : 'off') as 'singleFile' | 'off',
        links: !isMobileLike,
        suggest: {
          autoImports: autoImports,
          showWords: !customAutocomplete,
        },
        quickSuggestions: !customAutocomplete,
      }),
      [
        readOnly,
        hideGutter,
        fontSizeOverride,
        disableAutocomplete,
        lineWrap,
        isMobileLike,
        autoImports,
        customAutocomplete,
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
