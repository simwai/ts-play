import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import * as TS from 'typescript'

// Basic libs - core TS
import lib_es5_d_ts from 'typescript/lib/lib.es5.d.ts?raw'
import lib_es2020_d_ts from 'typescript/lib/lib.es2020.d.ts?raw'
import lib_dom_d_ts from 'typescript/lib/lib.dom.d.ts?raw'

let languageService: TS.LanguageService | undefined
let isEsbuildInitialized = false
let workerInitializationPromise: Promise<void> | undefined

const virtualFiles: Record<string, { version: number; content: string }> = {}
const defaultLibraryFiles: Record<string, string> = {
  'lib.es5.d.ts': lib_es5_d_ts,
  'lib.es2020.d.ts': lib_es2020_d_ts,
  'lib.dom.d.ts': lib_dom_d_ts,
}
let externalPackageDefinitions: Record<string, string> = {}
let externalPackageVersion = 0

async function initializeLanguageService() {
  if (languageService) return

  const compilerOptions: TS.CompilerOptions = {
    target: TS.ScriptTarget.ES2020,
    module: TS.ModuleKind.ESNext,
    moduleResolution: TS.ModuleResolutionKind.Node10,
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    strict: true,
    skipLibCheck: true,
    noImplicitAny: false,
    baseUrl: '/',
    paths: {
      "*": ["node_modules/*"]
    }
  }

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [
      '/main.ts',
      ...Object.keys(defaultLibraryFiles).map((f) => '/' + f),
      ...Object.keys(externalPackageDefinitions),
    ],
    getScriptVersion: (fileName) => {
      if (fileName === '/main.ts') return String(virtualFiles['main.ts']?.version ?? 0)
      if (externalPackageDefinitions[fileName]) return String(externalPackageVersion)
      return '0'
    },
    getScriptSnapshot: (fileName) => {
      let content: string | undefined
      if (fileName === '/main.ts') content = virtualFiles['main.ts']?.content
      else if (defaultLibraryFiles[fileName.replace(/^\//, '')]) content = defaultLibraryFiles[fileName.replace(/^\//, '')]
      else content = externalPackageDefinitions[fileName]

      return content !== undefined ? TS.ScriptSnapshot.fromString(content) : undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: (path) => externalPackageDefinitions[path] !== undefined || defaultLibraryFiles[path.replace(/^\//, '')] !== undefined || path === '/main.ts',
    readFile: (path) => externalPackageDefinitions[path] || defaultLibraryFiles[path.replace(/^\//, '')] || (path === '/main.ts' ? virtualFiles['main.ts']?.content : undefined),
    readDirectory: (path, extensions) => {
       const normalizedPath = path.endsWith('/') ? path : path + '/'
       return Object.keys(externalPackageDefinitions).filter(f => f.startsWith(normalizedPath) && (!extensions || extensions.some(e => f.endsWith(e))))
    },
    directoryExists: (path) => {
       const normalizedPath = path.endsWith('/') ? path : path + '/'
       return Object.keys(externalPackageDefinitions).some(f => f.startsWith(normalizedPath))
    },
  }

  languageService = TS.createLanguageService(host)
}

function generateAmbientDeclarations(sourceCode: string): string {
  // Use TypeScript's real compiler to generate declarations if possible,
  // or fall back to a simplified version if esbuild handles the heavy lifting.
  // For now, let's keep the user's existing generator logic but simplified.
  return "// Declarations auto-generated from main.ts\n" + sourceCode.split('\n').filter(l => l.startsWith('export')).join('\n');
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

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
        const { content } = payload
        const fileState = virtualFiles['main.ts']
        if (!fileState || fileState.content !== content) {
          virtualFiles['main.ts'] = { version: (fileState?.version || 0) + 1, content }
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

      case 'GET_DIAGNOSTICS': {
        if (!languageService) { result = []; break }
        const all = [...languageService.getSyntacticDiagnostics('main.ts'), ...languageService.getSemanticDiagnostics('main.ts')]
        result = all.map(d => ({
          start: d.start || 0,
          length: d.length || 0,
          message: typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText,
          category: d.category === TS.DiagnosticCategory.Warning ? 'warning' : 'error',
          line: TS.getLineAndCharacterOfPosition(d.file!, d.start!).line,
          character: TS.getLineAndCharacterOfPosition(d.file!, d.start!).character,
        }))
        break
      }

      case 'GET_TYPE_INFO': {
        if (!languageService) { result = undefined; break }
        const info = languageService.getQuickInfoAtPosition('main.ts', payload.offset)
        if (!info) { result = undefined; break }
        result = {
          name: TS.displayPartsToString(info.displayParts),
          kind: info.kind,
          typeAnnotation: TS.displayPartsToString(info.displayParts),
          jsDoc: info.documentation ? TS.displayPartsToString(info.documentation) : undefined,
        }
        break
      }

      case 'GET_COMPLETIONS': {
        if (!languageService) { result = []; break }
        const completions = languageService.getCompletionsAtPosition('main.ts', payload.offset, undefined)
        result = completions ? completions.entries.map(e => ({ name: e.name, kind: e.kind, insertText: e.insertText })) : []
        break
      }

      case 'COMPILE': {
        const compiled = await esbuild.build({
          bundle: false, format: 'esm', target: 'es2020', write: false,
          stdin: { contents: payload.code, loader: 'ts', sourcefile: 'main.ts' },
        })
        result = { js: compiled.outputFiles?.[0]?.text || '', dts: generateAmbientDeclarations(payload.code) }
        break
      }

      case 'DETECT_IMPORTS': {
        const sourceFile = TS.createSourceFile('temp.ts', payload.code, TS.ScriptTarget.Latest, true)
        const imports = new Set<string>()
        const visit = (node: TS.Node) => {
          if (TS.isImportDeclaration(node) && TS.isStringLiteral(node.moduleSpecifier)) {
             const m = node.moduleSpecifier.text
             if (!m.startsWith('.') && !m.startsWith('/')) {
                const parts = m.split('/')
                imports.add(m.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0])
             }
          }
          TS.forEachChild(node, visit)
        }
        visit(sourceFile)
        result = [...imports]
        break
      }

      default: throw new Error(`Unknown worker message type: ${type}`)
    }
    self.postMessage({ id, success: true, payload: result })
  } catch (error) {
    self.postMessage({ id, success: false, error: getErrorMessage(error) })
  }
}
