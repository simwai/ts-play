import { useEffect } from 'react'
import * as monaco from 'monaco-editor'
import * as TS from 'typescript'

export function useMonacoCompilerOptions(tsConfigString: string) {
  useEffect(() => {
    try {
      const parsed = TS.parseConfigFileTextToJson(
        'tsconfig.json',
        tsConfigString
      )
      if (parsed.error) return
      const config = TS.parseJsonConfigFileContent(
        parsed.config,
        {
          useCaseSensitiveFileNames: true,
          readDirectory: () => [],
          fileExists: () => true,
          readFile: () => tsConfigString,
        },
        '/'
      )
      monaco.typescript.typescriptDefaults.setCompilerOptions(
        config.options as unknown as Parameters<
          typeof monaco.typescript.typescriptDefaults.setCompilerOptions
        >[0]
      )
    } catch {
      // Ignore parse errors
    }
  }, [tsConfigString])
}
