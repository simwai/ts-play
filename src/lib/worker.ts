import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'

const esbuildWasmUrl = new URL('esbuild-wasm/esbuild.wasm', import.meta.url)
  .href
let isEsbuildInitialized = false

let languageService: TS.LanguageService | undefined
let compilerOptions: TS.CompilerOptions = {
  target: TS.ScriptTarget.ES2022,
  module: TS.ModuleKind.ESNext,
  moduleResolution: TS.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  allowJs: true,
  jsx: TS.JsxEmit.ReactJSX,
  declaration: true,
}

const virtualFiles: Record<string, { content: string; version: number }> = {}
let externalPackageDefinitions: Record<string, string> = {}
let externalPackageVersion = 0

const defaultLibraryFiles: Record<string, string> = {}
let workerInitializationPromise: Promise<void> | null = null

async function initializeLanguageService() {
  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [
      '/main.ts',
      ...Object.keys(externalPackageDefinitions),
    ],
    getScriptVersion: (path) => {
      if (path === '/main.ts')
        return String(virtualFiles['/main.ts']?.version || 0)
      if (externalPackageDefinitions[path])
        return String(externalPackageVersion)
      return '0'
    },
    getScriptSnapshot: (path) => {
      let content: string | undefined
      const normalized = path.startsWith('/') ? path : '/' + path

      if (normalized === '/main.ts') {
        content = virtualFiles['/main.ts']?.content
      } else if (normalized.startsWith('/lib.')) {
        content = defaultLibraryFiles[normalized.substring(1)]
      } else {
        content =
          externalPackageDefinitions[normalized] ||
          externalPackageDefinitions[normalized.substring(1)]
      }

      return content !== undefined
        ? TS.ScriptSnapshot.fromString(content)
        : undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: (path) => {
      const normalized = path.startsWith('/') ? path : '/' + path
      return !!(
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        normalized === '/main.ts'
      )
    },
    readFile: (path) => {
      const normalized = path.startsWith('/') ? path : '/' + path
      return (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        (normalized === '/main.ts'
          ? virtualFiles['/main.ts']?.content
          : undefined)
      )
    },
    readDirectory: (path, extensions) => {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const searchPath = normalizedPath.startsWith('/')
        ? normalizedPath.substring(1)
        : normalizedPath
      return Object.keys(externalPackageDefinitions)
        .filter(
          (f) =>
            f.startsWith(searchPath) &&
            (!extensions || extensions.some((e) => f.endsWith(e)))
        )
        .map((f) => (f.startsWith('/') ? f : '/' + f))
    },
    directoryExists: (path) => {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const searchPath = normalizedPath.startsWith('/')
        ? normalizedPath.substring(1)
        : normalizedPath
      return Object.keys(externalPackageDefinitions).some((f) => {
        const nf = f.startsWith('/') ? f.substring(1) : f
        return nf.startsWith(searchPath)
      })
    },
  }

  languageService = TS.createLanguageService(host)
}

function generateAmbientDeclarations(sourceCode: string): string {
  return (
    '// Declarations auto-generated from main.ts\n' +
    sourceCode
      .split('\n')
      .filter((l) => l.startsWith('export'))
      .join('\n')
  )
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload } = messageEvent.data
  try {
    let result: any

    switch (type) {
      case 'INIT': {
        workerInitializationPromise ||= (async () => {
          if (!isEsbuildInitialized) {
            await esbuild.initialize({ wasmURL: esbuildWasmUrl, worker: false })
            isEsbuildInitialized = true
          }
          await initializeLanguageService()
        })()
        await workerInitializationPromise
        result = true
        break
      }

      case 'UPDATE_FILE': {
        const { content, filename = '/main.ts' } = payload
        const normalized = filename.startsWith('/') ? filename : '/' + filename
        const fileState = virtualFiles[normalized]
        if (!fileState || fileState.content !== content) {
          virtualFiles[normalized] = {
            version: (fileState?.version || 0) + 1,
            content,
          }
        }
        result = true
        break
      }

      case 'UPDATE_EXTRA_LIBS': {
        externalPackageDefinitions = payload.libs
        externalPackageVersion += 1
        if (virtualFiles['/main.ts']) virtualFiles['/main.ts'].version += 1
        result = true
        break
      }

      case 'UPDATE_CONFIG': {
        const { tsconfig } = payload
        const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
        if (parsed.config) {
          const host = {
            useCaseSensitiveFileNames: true,
            readDirectory: () => [],
            fileExists: () => true,
            readFile: () => tsconfig,
            getCurrentDirectory: () => '/',
          }
          const { options } = TS.parseJsonConfigFileContent(
            parsed.config,
            host,
            '/'
          )
          compilerOptions = { ...compilerOptions, ...options }
          if (virtualFiles['/main.ts']) virtualFiles['/main.ts'].version += 1
        }
        result = true
        break
      }

      case 'VALIDATE_CONFIG': {
        const { tsconfig } = payload
        const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
        if (parsed.error) {
          result = {
            valid: false,
            error: TS.flattenDiagnosticMessageText(
              parsed.error.messageText,
              '\n'
            ),
          }
        } else {
          result = { valid: true }
        }
        break
      }

      case 'GET_DIAGNOSTICS': {
        if (!languageService) {
          result = []
          break
        }
        const all = [
          ...languageService.getSyntacticDiagnostics('/main.ts'),
          ...languageService.getSemanticDiagnostics('/main.ts'),
        ]
        result = all.map((d) => {
          let message = ''
          if (typeof d.messageText === 'string') {
            message = d.messageText
          } else {
            message = TS.flattenDiagnosticMessageText(d.messageText, '\n')
          }

          let line = 0
          let character = 0
          if (d.file && d.start !== undefined) {
            const pos = TS.getLineAndCharacterOfPosition(d.file, d.start)
            line = pos.line
            character = pos.character
          }

          return {
            start: d.start || 0,
            length: d.length || 0,
            message,
            category:
              d.category === TS.DiagnosticCategory.Warning
                ? 'warning'
                : 'error',
            line,
            character,
          }
        })
        break
      }

      case 'GET_TYPE_INFO': {
        if (!languageService) {
          result = undefined
          break
        }
        const info = languageService.getQuickInfoAtPosition(
          '/main.ts',
          payload.offset
        )
        if (!info) {
          result = undefined
          break
        }

        const SYMBOL_KINDS = new Set([
          'localName',
          'variableName',
          'parameterName',
          'methodName',
          'functionName',
          'className',
          'interfaceName',
          'aliasName',
          'propertyName',
          'enumName',
          'enumMemberName',
          'moduleName',
          'typeParameterName',
        ])
        const symbolPart = info.displayParts.find((p) =>
          SYMBOL_KINDS.has(p.kind)
        )
        const name = symbolPart ? symbolPart.text : ''

        const typeAnnotation = TS.displayPartsToString(info.displayParts)
        let jsDoc = info.documentation
          ? TS.displayPartsToString(info.documentation)
          : ''

        if (info.tags) {
          const tagsText = info.tags
            .map((tag) => {
              const text = TS.displayPartsToString(tag.text)
              return `\n\n@${tag.name}${text ? ' ' + text : ''}`
            })
            .join('')
          jsDoc += tagsText
        }

        result = {
          name,
          kind: info.kind,
          typeAnnotation,
          jsDoc: jsDoc.trim() || undefined,
        }
        break
      }

      case 'GET_COMPLETIONS': {
        if (!languageService) {
          result = []
          break
        }
        const completions = languageService.getCompletionsAtPosition(
          '/main.ts',
          payload.offset,
          undefined
        )
        result = completions
          ? completions.entries.map((e) => ({
              name: e.name,
              kind: e.kind,
              insertText: e.insertText,
            }))
          : []
        break
      }

      case 'COMPILE': {
        // Sync virtual file first
        virtualFiles['/main.ts'] = {
          version: (virtualFiles['/main.ts']?.version || 0) + 1,
          content: payload.code,
        }

        const compiled = await esbuild.build({
          bundle: false,
          format: 'esm',
          target: 'es2020',
          write: false,
          stdin: {
            contents: payload.code,
            loader: 'ts',
            sourcefile: '/main.ts',
          },
        })

        let dts = ''
        if (languageService) {
          const output = languageService.getEmitOutput('/main.ts', true)
          const dtsFile = output.outputFiles.find((f) =>
            f.name.endsWith('.d.ts')
          )
          if (dtsFile) dts = dtsFile.text
        }

        if (!dts) {
          dts = generateAmbientDeclarations(payload.code)
        }

        result = {
          js: compiled.outputFiles?.[0]?.text || '',
          dts,
        }
        break
      }

      case 'DETECT_IMPORTS': {
        const sourceFile = TS.createSourceFile(
          'temp.ts',
          payload.code,
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
                m.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
              )
            }
          }
          TS.forEachChild(node, visit)
        }
        visit(sourceFile)
        result = [...imports]
        break
      }

      default:
        throw new Error(`Unknown worker message type: ${type}`)
    }
    self.postMessage({ id, success: true, payload: result })
  } catch (error) {
    self.postMessage({ id, success: false, error: getErrorMessage(error) })
  }
}
