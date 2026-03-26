import React, { useEffect, useRef, useMemo } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { cn } from '../lib/utils';
import { RegexPatterns, toRegExp } from '../lib/regex';
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
  onTypeInfoChange?: (info: any) => void;
  onCursorPosChange?: (pos: { line: number; col: number }) => void;
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
  themeMode?: string;
  path?: string;
};

export type CodeEditorHandle = {
  undo: () => void;
  redo: () => void;
  focus: () => void;
};

let themesRegistered = false;
const FONT_STACK = "'JetBrains Mono', 'Victor Mono', 'Fira Code', monospace";

export const CodeEditor = React.memo(
  React.forwardRef<CodeEditorHandle, CodeEditorProps>((props, ref) => {
    const {
      value,
      onChange,
      onCursorChange,
      onTypeInfoChange,
      onCursorPosChange,
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

    React.useImperativeHandle(ref, () => ({
      undo: () => editorRef.current?.trigger('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger('keyboard', 'redo', null),
      focus: () => editorRef.current?.focus(),
    }));

    const modelUri = useMemo(() => {
       if (!path) return undefined;
       return monaco?.Uri.parse(`file:///${path.replace(toRegExp(RegexPatterns.LEADING_SLASH), '')}`);
    }, [monaco, path]);

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

        if (extraLibs) {
           const libs = Object.entries(extraLibs).map(([p, content]) => ({
             content,
             filePath: `file:///${p.replace(toRegExp(RegexPatterns.LEADING_SLASH), '')}`,
           }));
           tsDefaults.setExtraLibs(libs);
           jsDefaults.setExtraLibs(libs);
        }

        const options = {
          target: monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
          allowJs: true,
          isolatedModules: true,
          typeRoots: ['node_modules/@types'],
          baseUrl: '.',
          paths: {
            '*': ['node_modules/*'],
          },
        };
        tsDefaults.setCompilerOptions(options);
        jsDefaults.setCompilerOptions(options as any);
      } catch (err) {
        console.error('Monaco Setup Error:', err);
      }
    }, [monaco, extraLibs, disableDiagnostics]);

    useEffect(() => {
      if (!monaco || !modelUri) return;
      const model = monaco.editor.getModel(modelUri);
      if (model && model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }
    }, [monaco, modelUri, language]);

    const typeInfoCallbackRef = useRef(onTypeInfoChange);
    useEffect(() => {
      typeInfoCallbackRef.current = onTypeInfoChange;
    }, [onTypeInfoChange]);

    const handleEditorDidMount: OnMount = (editor) => {
      editorRef.current = editor;
      editor.onDidChangeCursorPosition(async (e: any) => {
        const model = editor.getModel();
        if (!model) return;

        onCursorChange?.(model.getOffsetAt(e.position));
        onCursorPosChange?.({
          line: e.position.lineNumber,
          col: e.position.column,
        });

        if (
          !typeInfoCallbackRef.current ||
          (language !== 'typescript' && language !== 'javascript')
        ) {
          typeInfoCallbackRef.current?.(null);
          return;
        }
        try {
          const isTS = language === 'typescript';
          const getter = await (isTS
            ? monaco.languages.typescript.getTypeScriptWorker()
            : monaco.languages.typescript.getJavaScriptWorker());
          const worker = await getter(model.uri);
          const info = await worker.getQuickInfoAtPosition(
            model.uri.toString(),
            model.getOffsetAt(e.position),
          );

          if (!info) {
            typeInfoCallbackRef.current(null);
            return;
          }

          const typeAnnotation =
            info.displayParts?.map((p: any) => p.text).join('') || '';
          const name =
            info.displayParts?.find((p: any) =>
              [
                'propertyName',
                'className',
                'functionName',
                'methodName',
                'interfaceName',
                'enumName',
                'moduleName',
                'typeParameterName',
                'parameterName',
                'localName',
                'aliasName',
              ].includes(p.kind),
            )?.text || '';
          const jsDoc =
            info.documentation?.map((p: any) => p.text).join('\n') || '';

          typeInfoCallbackRef.current({
            name,
            kind: info.kind,
            typeAnnotation,
            jsDoc,
            signature: typeAnnotation,
          });
        } catch {
          typeInfoCallbackRef.current?.(null);
        }
      });
    };

    const options = useMemo(
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
        padding: { top: 8, bottom: 8 },
        fixedOverflowWidgets: true,
        links: false,
        contextmenu: false,
        theme: themeMode,
        suggest: { enabled: !disableAutocomplete },
        hover: { enabled: !hideTypeInfo },
        renderLineHighlight: 'all' as const,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true },
        scrollbar: {
          vertical: hideGutter ? ('hidden' as const) : ('auto' as const),
        },
      }),
      [
        fontSizeOverride,
        readOnly,
        hideGutter,
        lineWrap,
        disableAutocomplete,
        hideTypeInfo,
        themeMode,
      ],
    );

    return (
      <div
        data-testid="code-editor-container"
        className={cn('code-editor w-full h-full flex flex-col', className)}
      >
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          onMount={handleEditorDidMount}
          path={path}
          options={options}
          theme={themeMode}
        />
      </div>
    );
  }),
);
