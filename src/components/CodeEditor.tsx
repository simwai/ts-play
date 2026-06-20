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
import { type ThemeMode, isDarkMode } from '../lib/theme'
import type { TypeInfo } from '../lib/types'

export type CodeEditorHandle = {
  undo: () => void
  redo: () => void
}

export type CodeEditorRef = CodeEditorHandle

type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  onCursorChange?: (offset: number) => void
  onTypeInfoChange?: (info: TypeInfo | null) => void
  language?: 'typescript' | 'javascript' | 'json'
  readOnly?: boolean
  hideGutter?: boolean
  hideTypeInfo?: boolean
  fontSizeOverride?: number
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  disableShortcuts?: boolean
  themeMode?: ThemeMode
  path?: string
  lineWrap?: boolean
  extraLibs?: Record<string, string>
  isMobileLike?: boolean
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  (
    {
      value,
      onChange,
      onCursorChange,
      onTypeInfoChange,
      language = 'typescript',
      readOnly = false,
      hideGutter = false,
      hideTypeInfo = false,
      fontSizeOverride,
      disableAutocomplete = false,
      disableDiagnostics = false,
      disableShortcuts = false,
      themeMode = 'mocha',
      path = 'file:///index.ts',
      lineWrap = true,
      extraLibs = {},
      isMobileLike = false,
    },
    ref
  ) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const monaco = useMonaco()

    useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
    }))

    const handleBeforeMount: BeforeMount = (monaco) => {
      monaco.editor.defineTheme('github-dark', githubDark)
      monaco.editor.defineTheme('github-light', githubLight)
      monaco.editor.defineTheme('latte', latte)
      monaco.editor.defineTheme('mocha', mocha)
      monaco.editor.defineTheme('monokai', monokai)
      monaco.editor.defineTheme('shades-of-purple', shadesOfPurple)

      const ts = (monaco.languages as any).typescript
      if (ts) {
        ts.typescriptDefaults.setCompilerOptions({
          target: ts.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution:
            ts.ModuleResolutionKind.NodeJs,
          module: ts.ModuleKind.CommonJS,
          noEmit: true,
          esModuleInterop: true,
          jsx: ts.JsxEmit.React,
          reactNamespace: 'React',
          allowJs: true,
          typeRoots: ['node_modules/@types'],
        })
      }
    }

    const handleEditorMount: OnMount = (editor, monaco) => {
      editorRef.current = editor as editor.IStandaloneCodeEditor

      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel()
        if (model) {
          const offset = model.getOffsetAt(e.position)
          onCursorChange?.(offset)
        }
      })

      editor.onDidChangeCursorPosition(async (e) => {
        const model = editor.getModel()
        const ts = (monaco.languages as any).typescript
        if (!model || !onTypeInfoChange || hideTypeInfo || !ts) return

        try {
          const worker = await ts.getTypeScriptWorker()
          const client = await worker(model.uri)
          const offset = model.getOffsetAt(e.position)

          const info = await client.getQuickInfoAtPosition(
            model.uri.toString(),
            offset
          )
          if (info) {
            const displayParts: any[] = info.displayParts || []
            const documentation: any[] = info.documentation || []
            const text = displayParts.map((p) => p.text).join('')

            const nameMatch = text.match(
              /^(?:const|let|var|function|class|interface|type|enum)\s+([^\s:(]+)/
            )
            const name = nameMatch ? nameMatch[1] : ''

            onTypeInfoChange({
              name,
              kind: info.kind,
              type: text,
              documentation: documentation.map((d) => d.text).join('\n'),
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
        const ts = (monaco.languages as any).typescript
        if (ts) {
          const libs = Object.entries(extraLibs).map(([key, content]) => ({
            content,
            filePath: key.startsWith('file://')
              ? key
              : `file:///node_modules/@types/${key}/index.d.ts`,
          }))
          ts.typescriptDefaults.setExtraLibs(libs)
        }
      }
    }, [monaco, extraLibs])

    const options = useMemo(
      () => ({
        minimap: { enabled: false },
        fontSize: fontSizeOverride || (isMobileLike ? 12 : 14),
        fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
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

    return (
      <div className='w-full h-full relative group'>
        <Editor
          height='100%'
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorMount}
          beforeMount={handleBeforeMount}
          theme={
            themeMode === 'mocha'
              ? 'mocha'
              : isDarkMode(themeMode)
                ? 'github-dark'
                : 'github-light'
          }
          options={options}
          path={path === 'file:///index.ts' && language === 'javascript' ? 'file:///index.js' : path === 'file:///index.ts' && language === 'json' ? 'file:///tsconfig.json' : path}
        />
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'
