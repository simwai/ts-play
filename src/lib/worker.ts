import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'

// Type mappings for TS libs (Vite ?raw imports)
import lib_es5 from 'typescript/lib/lib.es5.d.ts?raw'
import lib_es2020 from 'typescript/lib/lib.es2020.d.ts?raw'
import lib_dom from 'typescript/lib/lib.dom.d.ts?raw'

const defaultLibraryFiles: Record<string, string> = {
  'lib.es5.d.ts': lib_es5,
  'lib.es2020.d.ts': lib_es2020,
  'lib.dom.d.ts': lib_dom,
}

let languageService: TS.LanguageService | undefined
let compilerOptions: TS.CompilerOptions = {
  target: TS.ScriptTarget.ES2020,
  module: TS.ModuleKind.ESNext,
  moduleResolution: TS.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
  jsx: TS.JsxEmit.React,
  allowJs: true,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
}

const virtualFiles: Record<string, { content: string; version: number }> = {}
let externalPackageDefinitions: Record<string, string> = {}
let externalPackageVersion = 0

let isEsbuildInitialized = false
let workerInitializationPromise: Promise<void> | null = null

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : '/' + path
}

async function initializeLanguageService() {
  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => ['main.ts', ...Object.keys(externalPackageDefinitions).map(normalizePath)],
    getScriptVersion: (fileName) => {
      const normalized = normalizePath(fileName)
      if (normalized === '/main.ts') return String(virtualFiles['main.ts']?.version ?? 0)
      if (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)]
      )
        return String(externalPackageVersion)
      return '0'
    },
    getScriptSnapshot: (fileName) => {
      let content: string | undefined
      const normalized = normalizePath(fileName)

      if (normalized === '/main.ts') {
        content = virtualFiles['main.ts']?.content
      } else if (defaultLibraryFiles[normalized.substring(1)]) {
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
      const normalized = normalizePath(path)
      return !!(
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        normalized === '/main.ts'
      )
    },
    readFile: (path) => {
      const normalized = normalizePath(path)
      return (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        (normalized === '/main.ts'
          ? virtualFiles['main.ts']?.content
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
        .map(normalizePath)
    },
    directoryExists: (path) => {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const searchPath = normalizedPath.startsWith('/')
        ? normalizedPath.substring(1)
        : normalizedPath
      return Object.keys(externalPackageDefinitions).some((f) =>
        f.startsWith(searchPath)
      )
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
    let result: unknown

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
        const { content, filename = 'main.ts' } = payload
        const fileState = virtualFiles[filename]
        if (!fileState || fileState.content !== content) {
          virtualFiles[filename] = {
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
        if (virtualFiles['main.ts']) virtualFiles['main.ts'].version += 1
        result = true
        break
      }

      case 'UPDATE_CONFIG': {
        const { tsconfig } = payload
        const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
        if (parsed.config) {
          const host = {
            useCaseSensitiveFileNames: true,
            readDirectory: () => [] as string[],
            fileExists: () => true,
            readFile: () => tsconfig as string,
            getCurrentDirectory: () => '/',
          }
          const { options } = TS.parseJsonConfigFileContent(
            parsed.config,
            host,
            '/'
          )
          compilerOptions = { ...compilerOptions, ...options }
          if (virtualFiles['main.ts']) virtualFiles['main.ts'].version += 1
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
          ...languageService.getSyntacticDiagnostics('main.ts'),
          ...languageService.getSemanticDiagnostics('main.ts'),
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
          'main.ts',
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
        const displayParts = info.displayParts || []
        const documentation = info.documentation || []
        const symbolPart = displayParts.find((p) =>
          SYMBOL_KINDS.has(p.kind)
        )
        const name = symbolPart
          ? symbolPart.text
          : TS.displayPartsToString(displayParts)

        const typeAnnotation = TS.displayPartsToString(displayParts)
        let jsDoc = TS.displayPartsToString(documentation)

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
          'main.ts',
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
        const compiled = await esbuild.build({
          bundle: false,
          format: 'esm',
          target: 'es2020',
          write: false,
          stdin: {
            contents: payload.code,
            loader: 'ts',
            sourcefile: 'main.ts',
          },
        })
        result = {
          js: compiled.outputFiles?.[0]?.text || '',
          dts: generateAmbientDeclarations(payload.code),
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
                m.startsWith('@') ? `${parts[0]}/${parts[1]}` : (parts[0] || '')
              )
            }
          }
          TS.forEachChild(node, visit)
        }
        visit(sourceFile)
        result = [...imports].filter(Boolean)
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
