import * as esbuild from 'esbuild-wasm'
import * as TS from 'typescript'

// esbuild-wasm URL (CDN)
const esbuildWasmUrl = 'https://cdn.jsdelivr.net/npm/esbuild-wasm@0.23.1/esbuild.wasm'

let isEsbuildInitialized = false
let languageService: TS.LanguageService | null = null
let compilerOptions: TS.CompilerOptions = {
  target: TS.ScriptTarget.ES2020,
  module: TS.ModuleKind.ESNext,
  moduleResolution: TS.ModuleResolutionKind.NodeNext,
  lib: ['esnext', 'dom'],
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  jsx: TS.JsxEmit.ReactJSX,
}

const virtualFiles: Record<string, { content: string; version: number }> = {}
let externalPackageDefinitions: Record<string, string> = {}
let externalPackageVersion = 0

// Standard library files for TS Worker
const TS_LIB_FILES = [
  'lib.esnext.d.ts',
  'lib.dom.d.ts',
  'lib.es2020.d.ts',
  'lib.es2015.d.ts',
  'lib.es5.d.ts',
]
const tsLibCache: Record<string, string> = {}

async function fetchTsLib(name: string) {
  if (tsLibCache[name]) return tsLibCache[name]
  const res = await fetch(`https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/${name}`)
  if (!res.ok) throw new Error(`Failed to fetch TS lib: ${name}`)
  const content = await res.text()
  tsLibCache[name] = content
  return content
}

async function initializeLanguageService() {
  if (languageService) return

  // Prefetch basic libs
  await Promise.all(TS_LIB_FILES.map(fetchTsLib))

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [
      '/main.ts',
      ...Object.keys(externalPackageDefinitions),
      ...TS_LIB_FILES.map((f) => `/${f}`),
    ],
    getScriptVersion: (filename) => {
      if (filename === '/main.ts') return String(virtualFiles[filename]?.version || 0)
      if (filename.startsWith('/node_modules/')) return String(externalPackageVersion)
      return '0'
    },
    getScriptSnapshot: (filename) => {
      let content = ''
      if (filename === '/main.ts') {
        content = virtualFiles[filename]?.content || ''
      } else if (filename.startsWith('/node_modules/')) {
        content = externalPackageDefinitions[filename] || ''
      } else if (TS_LIB_FILES.some((f) => filename === `/${f}`)) {
        content = tsLibCache[filename.slice(1)] || ''
      }

      return TS.ScriptSnapshot.fromString(content)
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => 'lib.esnext.d.ts',
    fileExists: (path) =>
      path === '/main.ts' ||
      !!externalPackageDefinitions[path] ||
      TS_LIB_FILES.some((f) => path === `/${f}`),
    readFile: (path) => {
      if (path === '/main.ts') return virtualFiles[path]?.content
      if (path.startsWith('/node_modules/')) return externalPackageDefinitions[path]
      if (TS_LIB_FILES.some((f) => path === `/${f}`)) return tsLibCache[path.slice(1)]
      return undefined
    },
    directoryExists: (path) => path === '/' || path === '/node_modules',
    getDirectories: (path) => (path === '/' ? ['node_modules'] : []),
  }

  languageService = TS.createLanguageService(host, TS.createDocumentRegistry())
}

function generateAmbientDeclarations(code: string): string {
  // Simple fallback DTS generator for when LS fails
  return `declare module "main" {
  // Ambient declarations for rapid feedback
}`
}

let workerInitializationPromise: Promise<void> | null = null

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'msg' in error) return String((error as any).msg)
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as any).message)
  return String(error)
}

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload } = messageEvent.data
  try {
    let result: any

    switch (type) {
      case 'INIT': {
        if (!workerInitializationPromise) {
          workerInitializationPromise = (async () => {
            if (!isEsbuildInitialized) {
              try {
                await esbuild.initialize({
                  wasmURL: esbuildWasmUrl,
                  worker: false,
                })
                isEsbuildInitialized = true
              } catch (e: any) {
                const msg = getErrorMessage(e)
                if (!msg.includes('already initialized')) throw e
                isEsbuildInitialized = true
              }
            }
            await initializeLanguageService()
          })()
        }
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
        const symbolPart = (info.displayParts || []).find((p) =>
          SYMBOL_KINDS.has(p.kind)
        )
        const name = symbolPart ? symbolPart.text : ''

        const typeAnnotation = TS.displayPartsToString(info.displayParts || [])
        let jsDoc = info.documentation
          ? TS.displayPartsToString(info.documentation)
          : ''

        if (info.tags) {
          const tagsText = info.tags
            .map((tag) => {
              const text = TS.displayPartsToString(tag.text || [])
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
