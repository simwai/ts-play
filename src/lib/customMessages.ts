import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'
import { toErrorMessage } from './errors'
import { LanguageServiceState } from './languageService'
import { generateAmbientDeclarations } from './languageService'
import type {
  CustomMessageType,
  UpdateFilePayload,
  UpdateExtraLibsPayload,
  UpdateConfigPayload,
  ValidateConfigPayload,
  CompilePayload,
  DetectImportsPayload,
} from './workerProtocol'

function assertUpdateFile(payload: unknown): UpdateFilePayload {
  return payload as UpdateFilePayload
}
function assertUpdateExtraLibs(payload: unknown): UpdateExtraLibsPayload {
  return payload as UpdateExtraLibsPayload
}
function assertUpdateConfig(payload: unknown): UpdateConfigPayload {
  return payload as UpdateConfigPayload
}
function assertValidateConfig(payload: unknown): ValidateConfigPayload {
  return payload as ValidateConfigPayload
}
function assertCompile(payload: unknown): CompilePayload {
  return payload as CompilePayload
}
function assertDetectImports(payload: unknown): DetectImportsPayload {
  return payload as DetectImportsPayload
}

export async function handleCustomMessage(
  type: CustomMessageType,
  payload: unknown,
  state: LanguageServiceState
): Promise<unknown> {
  switch (type) {
    case 'UPDATE_FILE': {
      const { content = '', filename = '/main.ts' } = assertUpdateFile(payload)
      const normalized = filename.startsWith('/') ? filename : '/' + filename
      // Add module marker to avoid global conflicts
      const hasModuleMarker = /^\s*(import|export)\s/m.test(content)
      const finalContent = hasModuleMarker
        ? content
        : content + '\nexport {};\n'
      const fileState = state.virtualFiles[normalized]
      if (!fileState || fileState.content !== finalContent) {
        state.virtualFiles[normalized] = {
          version: (fileState?.version || 0) + 1,
          content: finalContent,
        }
      }
      return true
    }
    case 'UPDATE_EXTRA_LIBS': {
      const rawLibs = assertUpdateExtraLibs(payload).libs ?? {}
      const wrappedLibs: Record<string, string> = {}
      for (const [path, content] of Object.entries(rawLibs)) {
        const isDeclarationFile = path.endsWith('.d.ts')
        const hasModuleMarker = /^\s*(import|export)\s/m.test(content)
        wrappedLibs[path] =
          isDeclarationFile && !hasModuleMarker
            ? content + '\nexport {};\n'
            : content
      }
      state.externalPackageDefinitions = wrappedLibs
      state.externalPackageVersion += 1
      if (state.virtualFiles['/main.ts'])
        state.virtualFiles['/main.ts'].version += 1
      return true
    }
    case 'UPDATE_CONFIG': {
      const { tsconfig = '' } = assertUpdateConfig(payload)
      const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
      if (parsed.error) return false
      const host = {
        useCaseSensitiveFileNames: true,
        readDirectory: (path: string, extensions?: readonly string[]) =>
          Object.keys(state.externalPackageDefinitions)
            .filter(
              (f) =>
                f.startsWith(path) &&
                (!extensions || extensions.some((e) => f.endsWith(e)))
            )
            .map((f) => (f.startsWith('/') ? f : '/' + f)),
        fileExists: (path: string): boolean => {
          const normalized = path.replace(/^file:\/\/\//, '/')
          const finalPath = normalized.startsWith('/')
            ? normalized
            : '/' + normalized
          return !!(
            state.externalPackageDefinitions[finalPath] ||
            state.externalPackageDefinitions[finalPath.substring(1)] ||
            finalPath === '/main.ts' ||
            finalPath === '/tsconfig.json'
          )
        },
        readFile: (path: string) => {
          const normalized = path.replace(/^file:\/\/\//, '/')
          const finalPath = normalized.startsWith('/')
            ? normalized
            : '/' + normalized
          if (finalPath === '/main.d.ts') return undefined
          return (
            state.externalPackageDefinitions[finalPath] ||
            state.externalPackageDefinitions[finalPath.substring(1)] ||
            (finalPath === '/main.ts'
              ? state.virtualFiles['/main.ts']?.content
              : undefined)
          )
        },
      }
      const { options, errors } = TS.parseJsonConfigFileContent(
        parsed.config,
        host,
        '/'
      )
      if (errors.some((e) => e.code !== 18003)) return false
      state.compilerOptions = { ...state.compilerOptions, ...options }
      if (state.virtualFiles['/main.ts'])
        state.virtualFiles['/main.ts'].version += 1
      return true
    }
    case 'VALIDATE_CONFIG': {
      const { tsconfig = '' } = assertValidateConfig(payload)
      const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
      if (parsed.error) {
        return {
          valid: false,
          error: TS.flattenDiagnosticMessageText(
            parsed.error.messageText,
            '\n'
          ),
        }
      }
      const host = {
        useCaseSensitiveFileNames: true,
        readDirectory: (path: string, extensions?: readonly string[]) =>
          Object.keys(state.externalPackageDefinitions)
            .filter(
              (f) =>
                f.startsWith(path) &&
                (!extensions || extensions.some((e) => f.endsWith(e)))
            )
            .map((f) => (f.startsWith('/') ? f : '/' + f)),
        fileExists: (path: string): boolean => {
          const normalized = path.replace(/^file:\/\/\//, '/')
          const finalPath = normalized.startsWith('/')
            ? normalized
            : '/' + normalized
          return !!(
            state.externalPackageDefinitions[finalPath] ||
            state.externalPackageDefinitions[finalPath.substring(1)] ||
            finalPath === '/main.ts' ||
            finalPath === '/tsconfig.json'
          )
        },
        readFile: (path: string) => {
          const normalized = path.replace(/^file:\/\/\//, '/')
          const finalPath = normalized.startsWith('/')
            ? normalized
            : '/' + normalized
          if (finalPath === '/main.d.ts') return undefined
          return (
            state.externalPackageDefinitions[finalPath] ||
            state.externalPackageDefinitions[finalPath.substring(1)] ||
            (finalPath === '/main.ts'
              ? state.virtualFiles['/main.ts']?.content
              : undefined)
          )
        },
      }
      const { errors } = TS.parseJsonConfigFileContent(parsed.config, host, '/')
      const fatal = errors.filter((e) => e.code !== 18003)
      if (fatal.length) {
        return {
          valid: false,
          error: fatal
            .map((e) => TS.flattenDiagnosticMessageText(e.messageText, '\n'))
            .join('\n'),
        }
      }
      return { valid: true }
    }
    case 'COMPILE': {
      const { code = '' } = assertCompile(payload)
      state.virtualFiles['/main.ts'] = {
        version: (state.virtualFiles['/main.ts']?.version || 0) + 1,
        content: code,
      }
      const compiled = await esbuild.build({
        bundle: false,
        format: 'esm',
        target: 'es2023',
        write: false,
        stdin: {
          contents: code,
          loader: 'ts',
          sourcefile: '/main.ts',
        },
      })
      let dts = ''
      if (state.languageService) {
        const output = state.languageService.getEmitOutput('/main.ts', true)
        const dtsFile = output.outputFiles.find((f) => f.name.endsWith('.d.ts'))
        if (dtsFile) dts = dtsFile.text
      }
      if (!dts) dts = generateAmbientDeclarations(code)
      // The d.ts text becomes an editor model inside Monaco's TS program.
      // Without a module marker its script-scope ambient declarations
      // collide with the same globals in main.ts (false TS2451 markers).
      const dtsIsModule = /^\s*(import|export)\s/m.test(dts)
      if (!dtsIsModule) dts = dts + '\nexport {};\n'
      return { js: compiled.outputFiles?.[0]?.text || '', dts }
    }
    case 'DETECT_IMPORTS': {
      const { code = '' } = assertDetectImports(payload)
      const sourceFile = TS.createSourceFile(
        'temp.ts',
        code,
        TS.ScriptTarget.Latest,
        true
      )
      const imports = new Set<string>()
      const visit = (node: TS.Node) => {
        if (
          TS.isImportDeclaration(node) &&
          TS.isStringLiteral(node.moduleSpecifier)
        ) {
          const m = node.moduleSpecifier.text
          if (!m.startsWith('.') && !m.startsWith('/')) {
            const parts = m.split('/')
            imports.add(
              m.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0] || ''
            )
          }
        }
        TS.forEachChild(node, visit)
      }
      visit(sourceFile)
      return [...imports].filter(Boolean)
    }
    default:
      throw new Error(`Unknown custom message type: ${type}`)
  }
}
