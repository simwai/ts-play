import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { cn } from '../lib/utils';
import {
  mocha,
  latte,
  githubDark,
  githubLight,
  monokai,
} from '../lib/monaco-themes';

type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (offset: number) => void;
  onTypeInfoChange?: (info: string) => void;
  language?: 'typescript' | 'javascript' | 'json';
  readOnly?: boolean;
  extraLibs?: Record<string, string>;
  isMobileLike?: boolean;
  className?: string;
  fontSizeOverride?: number;
  hideGutter?: boolean;
  disableAutocomplete?: boolean;
  disableDiagnostics?: boolean;
  lineWrap?: boolean;
  hideTypeInfo?: boolean;
  disableShortcuts?: boolean;
  themeMode?: string;
  path?: string;
};

export type CodeEditorHandle = {
  undo: () => void;
  redo: () => void;
  focus: () => void;
};

let themesRegistered = false;

const FONT_STACK =
  "'JetBrains Mono', 'Victor Mono', 'Fira Code', 'Cascadia Code', monospace";

export const CodeEditor = React.memo(
  React.forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
    const {
      value,
      onChange,
      onCursorChange,
      onTypeInfoChange,
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
      themeMode = 'mocha',
      path,
    } = props;

    const monaco = useMonaco();
    const editorRef = useRef<any>(null);
    const fetchTypeInfoRef = useRef<any>(null);

    React.useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
      focus: () => editorRef.current?.focus(),
    }));

    useEffect(() => {
      if (!monaco) return;
      try {
        if (!themesRegistered) {
          monaco.editor.defineTheme('mocha', mocha);
          monaco.editor.defineTheme('latte', latte);
          monaco.editor.defineTheme('githubDark', githubDark);
          monaco.editor.defineTheme('githubLight', githubLight);
          monaco.editor.defineTheme('monokai', monokai);
          themesRegistered = true;
        }

        const tsDefaults = monaco.languages.typescript.typescriptDefaults;
        const jsDefaults = monaco.languages.typescript.javascriptDefaults;
        const jsonDefaults = monaco.languages.json.jsonDefaults;

        tsDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        });
        jsDefaults.setDiagnosticsOptions({
          noSemanticValidation: disableDiagnostics,
          noSyntaxValidation: disableDiagnostics,
        });
        jsonDefaults.setDiagnosticsOptions({
          validate: !disableDiagnostics,
          allowComments: true,
        });

        if (!extraLibs) return;

        const libs = Object.entries(extraLibs).map(([path, content]) => ({
          content,
          filePath: path.startsWith('file:///')
            ? path
            : `file:///node_modules/${path.replace(/^\//, '')}`,
        }));

        tsDefaults.setExtraLibs(libs);
        jsDefaults.setExtraLibs(libs);

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
        };
        tsDefaults.setCompilerOptions(options);
        jsDefaults.setCompilerOptions(options as any);
      } catch (err) {
        console.error('CodeEditor setup error:', err);
      }
    }, [monaco, extraLibs, disableDiagnostics]);

    const fetchTypeInfo = useCallback(
      async (editor: any, position: any) => {
        if (!monaco || !onTypeInfoChange || language !== 'typescript') return;

        try {
          const model = editor.getModel();
          if (!model) return;

          const workerGetter =
            await monaco.languages.typescript.getTypeScriptWorker();
          const worker = await workerGetter(model.uri);
          const offset = model.getOffsetAt(position);
          const info = await worker.getQuickInfoAtPosition(
            model.uri.toString(),
            offset,
          );

          if (info && info.displayParts) {
            const text = info.displayParts.map((p: any) => p.text).join('');
            onTypeInfoChange(text);
          } else {
            onTypeInfoChange('');
          }
        } catch (err) {
          // Only log error if not 'worker not found' which can happen during re-mounts
          if (!String(err).includes('worker')) {
            console.error('Failed to fetch type info:', err);
          }
          onTypeInfoChange('');
        }
      },
      [monaco, onTypeInfoChange, language],
    );

    useEffect(() => {
      fetchTypeInfoRef.current = fetchTypeInfo;
    });

    const handleEditorDidMount: OnMount = (editor) => {
      try {
        editorRef.current = editor;
        editor.onDidChangeCursorPosition((e: any) => {
          const model = editor.getModel();
          if (model) {
            const offset = model.getOffsetAt(e.position);
            onCursorChange?.(offset);
          }
          fetchTypeInfoRef.current?.(editor, e.position);
        });
      } catch (err) {
        console.error('CodeEditor mount error:', err);
      }
    };

    const editorOptions = useMemo(
      () => ({
        fontSize: fontSizeOverride || 12,
        lineHeight: (fontSizeOverride || 12) * 1.5,
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
        links: false,
        contextmenu: false,
        theme: themeMode,
        quickSuggestions: !isMobileLike,
        suggestOnTriggerCharacters: !isMobileLike,
        wordBasedSuggestions: 'currentDocument',
        tabCompletion: 'on',
        acceptSuggestionOnEnter: 'on',
        suggest: {
          showWords: false,
          enabled: !disableAutocomplete,
        },
        hover: {
          enabled: !hideTypeInfo,
        },
        renderLineHighlight: 'all' as const,
        renderLineHighlightOnlyWhenFocus: false,
        multiCursorModifier: 'alt',
        selectionHighlight: !isMobileLike,
        occurrencesHighlight: !isMobileLike,
        unicodeHighlight: { ambiguousCharacters: false, nonBasicASCII: false },
        colorDecorators: true,
        smoothScrolling: true,
        cursorSmoothCaretAnimation: 'on',
        mouseWheelZoom: !isMobileLike,
        dragAndDrop: !isMobileLike,
        dropIntoEditor: { enabled: true },
        accessibilitySupport: 'on',
        accessibilityPageSize: 10,
        selectOnLineNumbers: true,
        columnSelection: false,
        selectionClipboard: false,
        emptySelectionClipboard: false,
        matchBrackets: isMobileLike ? 'never' : 'always',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        formatOnPaste: true,
        formatOnType: true,
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
          alwaysConsumeMouseWheel: false,
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
        themeMode,
      ],
    );

    return (
      <div
        data-testid="code-editor-container"
        className={cn(
          'code-editor relative w-full h-full flex flex-col flex-1 overflow-hidden [touch-action:auto] [-webkit-user-select:text] [user-select:text] [-webkit-tap-highlight-color:transparent]',
          className,
        )}
      >
        <Editor
          height="100%"
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
          path={path}
          options={editorOptions}
          theme={themeMode}
        />
      </div>
    );
  }),
);
