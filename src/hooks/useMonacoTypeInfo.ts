import { useEffect, useRef } from 'react'
import type { editor } from 'monaco-editor'
import { type TypeInfo } from '../lib/types'
import { SYMBOL_KINDS, displayPartsToString, type MonacoDisplayPart, type MonacoDocumentation } from '../lib/monaco-utils'

export function useMonacoTypeInfo(
  editorInstance: editor.IStandaloneCodeEditor | null,
  monaco: any | null,
  language: string,
  hideTypeInfo: boolean,
  onTypeInfoChange?: (info: TypeInfo | null) => void
) {
  const typeInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editorInstance || !monaco || language !== 'typescript' || hideTypeInfo || !onTypeInfoChange) {
      return
    }

    const disposable = editorInstance.onDidChangeCursorPosition((e) => {
      if (typeInfoTimerRef.current) clearTimeout(typeInfoTimerRef.current)

      typeInfoTimerRef.current = setTimeout(async () => {
        const model = editorInstance.getModel()
        if (!model) return

        try {
          const ts = monaco.languages.typescript
          const worker = await ts.getTypeScriptWorker()
          const client = await worker(model.uri)
          const offset = model.getOffsetAt(e.position)
          const info = await client.getQuickInfoAtPosition(model.uri.toString(), offset)

          if (info) {
            const displayParts = (info.displayParts || []) as MonacoDisplayPart[]
            const documentation = (info.documentation || []) as MonacoDocumentation[]

            const symbolPart = displayParts.find((p) => SYMBOL_KINDS.has(p.kind))

            onTypeInfoChange({
              name: symbolPart ? symbolPart.text : '',
              kind: info.kind,
              typeAnnotation: displayPartsToString(displayParts),
              detail: displayPartsToString(documentation as any),
            })
          } else {
            onTypeInfoChange(null)
          }
        } catch {
          onTypeInfoChange(null)
        }
      }, 500)
    })

    return () => {
      disposable.dispose()
      if (typeInfoTimerRef.current) clearTimeout(typeInfoTimerRef.current)
    }
  }, [editorInstance, monaco, language, hideTypeInfo, onTypeInfoChange])
}
