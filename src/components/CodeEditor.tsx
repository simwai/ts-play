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
      language = 'typescript',
      readOnly = false,
      hideGutter = false,
      fontSizeOverride,
      disableAutocomplete = false,
      themeMode = 'mocha',
      path = 'file:///index.ts',
      lineWrap = true,
      extraLibs = {},
      isMobileLike = false,
    },
    ref
  ) => {
    const editorRef = useRef<any>(null)
    const monaco = useMonaco()

    useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
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
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
      })
    }

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor

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

      editor.onDidChangeCursorPosition(async (e) => {
        const model = editor.getModel()
        if (!model || !onTypeInfoChange) return

        try {
          const worker = await monaco.languages.typescript.getTypeScriptWorker()
          const client = await worker(model.uri)
          const offset = model.getOffsetAt(e.position)

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
      })
    }

    useEffect(() => {
      if (monaco) {
        const libs = Object.entries(extraLibs).map(([key, content]) => ({
          content,
          filePath: key.startsWith('file://')
            ? key
            : `file:///node_modules/@types/${key}/index.d.ts`,
        }))
        monaco.languages.typescript.typescriptDefaults.setExtraLibs(libs as any)
      }
    }, [monaco, extraLibs])

    const options = useMemo(
      () => ({
        minimap: { enabled: false },
        fontSize: fontSizeOverride || (isMobileLike ? 12 : 14),
        fontFamily: "'JetBrains Mono', 'Victor Mono', 'Fira Code', 'Cascadia Code', monospace",
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
        // Allow native context menu on mobile
        domReadOnly: isMobileLike,
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
          path={path}
        />
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'
