import { useEffect, useRef } from 'react'
import { type IDisposable } from 'monaco-editor'

export function useMonacoAutocomplete(
  monaco: any | null,
  language: string,
  customAutocomplete: boolean
) {
  const completionProviderRef = useRef<IDisposable | null>(null)

  useEffect(() => {
    if (!monaco || language !== 'typescript') return

    if (customAutocomplete) {
      if (completionProviderRef.current) completionProviderRef.current.dispose()

      completionProviderRef.current = monaco.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems: async (model: any, position: any) => {
          try {
            const ts = monaco.languages.typescript
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
