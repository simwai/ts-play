import * as TS from 'typescript'
import { LanguageServiceState } from './languageService'
import { defaultLibraryFiles } from './virtualFs'

export async function handleMonacoMethod(
  method: string,
  args: unknown[],
  fileName: string | undefined,
  state: LanguageServiceState
): Promise<unknown> {
  switch (method) {
    case 'init':
      // Critical: respond synchronously
      return { success: true }
    case 'getDefaultLibFileName':
      return '/lib.es2020.d.ts'
    case 'getScriptFileNames':
      return getScriptFileNames(state.externalPackageDefinitions)
    case 'getScriptVersion':
      return scriptVersionFor(
        fileName!,
        state.virtualFiles,
        state.externalPackageDefinitions,
        state.externalPackageVersion
      )
    case 'getScriptSnapshot':
      return snapshotFor(
        fileName!,
        state.virtualFiles,
        state.externalPackageDefinitions
      )
    case 'getDiagnostics': {
      if (!state.languageService) throw new Error('Undefined language service')
      const diags = [
        ...state.languageService.getSyntacticDiagnostics('/main.ts'),
        ...state.languageService.getSemanticDiagnostics('/main.ts'),
      ]
      return diags.map((d) => ({
        start: d.start ?? 0,
        length: d.length ?? 0,
        severity:
          d.category === TS.DiagnosticCategory.Error
            ? 8
            : d.category === TS.DiagnosticCategory.Warning
              ? 4
              : 2,
        message:
          typeof d.messageText === 'string'
            ? d.messageText
            : TS.flattenDiagnosticMessageText(d.messageText, '\n'),
        startLineNumber:
          d.file && d.start !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start).line + 1
            : 1,
        startColumn:
          d.file && d.start !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start).character + 1
            : 1,
        endLineNumber:
          d.file && d.start !== undefined && d.length !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start + d.length)
                .line + 1
            : 1,
        endColumn:
          d.file && d.start !== undefined && d.length !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start + d.length)
                .character + 1
            : 1,
        source: 'typescript',
        code: d.code,
      }))
    }
    case 'getCompletionsAtPosition': {
      if (!state.languageService) throw new Error('Undefined language service')
      return state.languageService.getCompletionsAtPosition(
        '/main.ts',
        args[0] as number,
        undefined
      )
    }
    case 'getQuickInfoAtPosition': {
      if (!state.languageService) throw new Error('Undefined language service')
      return state.languageService.getQuickInfoAtPosition(
        '/main.ts',
        args[0] as number
      )
    }
    case 'getEmitOutput': {
      if (!state.languageService) throw new Error('Undefined language service')
      return state.languageService.getEmitOutput('/main.ts', true)
    }
    default:
      throw new Error(`Unknown Monaco method: ${method}`)
  }
}

function getScriptFileNames(
  externalPackageDefinitions: Record<string, string>
): string[] {
  const libFiles = Object.keys(defaultLibraryFiles).map((f) => '/' + f)
  const externalFiles = Object.keys(externalPackageDefinitions).map((f) =>
    f.startsWith('/') ? f : '/' + f
  )
  const filtered = externalFiles.filter(
    (f) => f !== '/main.ts' && f !== '/main.d.ts'
  )
  return ['/main.ts', ...libFiles, ...filtered]
}

function scriptVersionFor(
  fileName: string,
  virtualFiles: Record<string, { content: string; version: number }>,
  externalPackageDefinitions: Record<string, string>,
  externalPackageVersion: number
): string {
  const normalized = fileName.replace(/^file:\/\/\//, '/')
  const finalPath = normalized.startsWith('/') ? normalized : '/' + normalized
  if (finalPath === '/main.ts')
    return String(virtualFiles['/main.ts']?.version ?? 0)
  if (
    externalPackageDefinitions[finalPath] ||
    externalPackageDefinitions[finalPath.substring(1)]
  )
    return String(externalPackageVersion)
  return '0'
}

function snapshotFor(
  fileName: string,
  virtualFiles: Record<string, { content: string; version: number }>,
  externalPackageDefinitions: Record<string, string>
): TS.IScriptSnapshot | undefined {
  const normalized = fileName.replace(/^file:\/\/\//, '/')
  const finalPath = normalized.startsWith('/') ? normalized : '/' + normalized
  if (finalPath === '/main.d.ts') return undefined
  let content: string | undefined
  if (finalPath === '/main.ts') content = virtualFiles['/main.ts']?.content
  else if (defaultLibraryFiles[finalPath.substring(1)])
    content = defaultLibraryFiles[finalPath.substring(1)]
  else
    content =
      externalPackageDefinitions[finalPath] ||
      externalPackageDefinitions[finalPath.substring(1)]
  return content !== undefined
    ? TS.ScriptSnapshot.fromString(content)
    : undefined
}
