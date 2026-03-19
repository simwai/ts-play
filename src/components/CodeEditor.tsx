import React, { useEffect, useRef, useMemo } from 'react'
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react'
import { cn } from '../lib/utils'

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
  disableAutocomplete?: boolean
  disableDiagnostics?: boolean
  lineWrap?: boolean
  hideTypeInfo?: boolean
  disableShortcuts?: boolean
}

export type CodeEditorHandle = {
  undo: () => void
  redo: () => void
  focus: () => void
}

const FONT_STACK =
  "'JetBrains Mono', 'Victor Mono', 'Fira Code', 'Cascadia Code', monospace"

export const CodeEditor = React.memo(
  React.forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
    const {
      value,
      onChange,
      onCursorChange,
      language = 'typescript',
      readOnly = false,
      extraLibs,
      isMobileLike,
      className,
      fontSizeOverride,
      hideGutter = false,
      disableAutocomplete = false,
      disableDiagnostics = false,
      lineWrap = false,
      hideTypeInfo = false,
    } = props

    const monaco = useMonaco()
    const editorRef = useRef<any>(null)

    React.useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
      focus: () => editorRef.current?.focus(),
    }))

    useEffect(() => {
      if (!monaco) return

      const tsDefaults = monaco.languages.typescript.typescriptDefaults
      const jsDefaults = monaco.languages.typescript.javascriptDefaults

      tsDefaults.setDiagnosticsOptions({
        noSemanticValidation: disableDiagnostics,
        noSyntaxValidation: disableDiagnostics,
      })
      jsDefaults.setDiagnosticsOptions({
        noSemanticValidation: disableDiagnostics,
        noSyntaxValidation: disableDiagnostics,
      })

      if (!extraLibs) return

      const libs = Object.entries(extraLibs).map(([path, content]) => ({
        content,
        filePath: path.startsWith('file:///')
          ? path
          : `file:///node_modules/${path.replace(/^\//, '')}`,
      }))

      tsDefaults.setExtraLibs(libs)
      jsDefaults.setExtraLibs(libs)

      const options = {
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
      }
      tsDefaults.setCompilerOptions(options)
      jsDefaults.setCompilerOptions(options as any)
    }, [monaco, extraLibs, disableDiagnostics])

    const handleEditorDidMount: OnMount = (editor) => {
      editorRef.current = editor
      editor.onDidChangeCursorPosition((e: any) => {
        const model = editor.getModel()
        if (model) {
          const offset = model.getOffsetAt(e.position)
          onCursorChange?.(offset)
        }
      })
    }

    const editorOptions = useMemo(
      () => ({
        fontSize: fontSizeOverride || 14,
        fontFamily: FONT_STACK,
        fontLigatures: true,
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: lineWrap ? ('on' as const) : ('off' as const),
        lineNumbers: hideGutter ? ('off' as const) : ('on' as const),
        glyphMargin: !hideGutter,
        folding: !hideGutter,
        lineDecorationsWidth: hideGutter ? 0 : 10,
        lineNumbersMinChars: hideGutter ? 0 : 3,
        padding: { top: 8, bottom: 8 },
        fixedOverflowWidgets: true,
        theme: 'vs-dark',
        suggest: {
          showWords: false,
          enabled: !disableAutocomplete && !isMobileLike,
        },
        hover: {
          enabled: !hideTypeInfo,
        },
        renderLineHighlight: 'all' as const,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          vertical: hideGutter ? ('hidden' as const) : ('auto' as const),
          horizontal: 'auto' as const,
          useShadows: false,
          verticalHasArrows: false,
          horizontalHasArrows: false,
        },
      }),
      [
        fontSizeOverride,
        readOnly,
        hideGutter,
        lineWrap,
        disableAutocomplete,
        isMobileLike,
        hideTypeInfo,
      ]
    )

    return (
      <div
        data-testid='code-editor-container'
        className={cn(
          'code-editor relative w-full h-full flex flex-col flex-1 overflow-hidden',
          className
        )}
      >
        <Editor
          height='100%'
          language={
            language === 'typescript'
              ? 'typescript'
              : language === 'json'
                ? 'json'
                : 'javascript'
          }
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorDidMount}
          options={editorOptions}
          theme='vs-dark'
        />
      </div>
    )
  })
)
