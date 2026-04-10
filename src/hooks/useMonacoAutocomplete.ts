import { useEffect, useRef } from 'react'
import type { IDisposable, editor, Position } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

export function useMonacoAutocomplete(
  monaco: Monaco | null,
  language: string,
  customAutocomplete: boolean
) {
  const completionProviderRef = useRef<IDisposable | null>(null)

  useEffect(() => {
    if (!monaco || language !== 'typescript') return

    if (customAutocomplete) {
      if (completionProviderRef.current) completionProviderRef.current.dispose()

      completionProviderRef.current = monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: async (model: editor.ITextModel, position: Position) => {
          try {
            // Justified 'any': Monaco's bundled types in @monaco-editor/react's Monaco object
            // can sometimes mis-type the 'languages' namespace properties.
            const ts: any = (monaco.languages as any)['typescript']
            const worker = await ts.getTypeScriptWorker()
            const client = await worker(model.uri)
            const completions = await client.getCompletionsAtPosition(
              model.uri.toString(),
              model.getOffsetAt(position)
            )

            if (!completions) return { suggestions: [] }

            return {
              suggestions: completions.entries.map((e: any) => ({
                label: e.name,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: e.name,
                detail: e.kind,
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endColumn: position.column,
                },
              })),
            }
          } catch {
            return { suggestions: [] }
          }
        },
      })
    } else if (completionProviderRef.current) {
      completionProviderRef.current.dispose()
      completionProviderRef.current = null
    }

    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose()
        completionProviderRef.current = null
      }
    }
  }, [monaco, language, customAutocomplete])
}
