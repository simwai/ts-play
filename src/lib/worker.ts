import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'

import lib_es5 from 'typescript/lib/lib.es5.d.ts?raw'
import lib_es2020 from 'typescript/lib/lib.es2020.d.ts?raw'
import lib_dom from 'typescript/lib/lib.dom.d.ts?raw'

const defaultLibraryFiles: Record<string, string> = {
  'lib.es5.d.ts': lib_es5,
  'lib.es2020.d.ts': lib_es2020,
  'lib.dom.d.ts': lib_dom,
}

// "No inputs were found in config file" — expected in the playground when the
// config host has no files on disk; not a user-facing config error.
const TS18003_NO_INPUTS = 18003

let languageService: TS.LanguageService | undefined
let compilerOptions: TS.CompilerOptions = {
  target: TS.ScriptTarget.ES2020,
  module: TS.ModuleKind.ESNext,
  moduleResolution: TS.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
  strict: true,
  skipLibCheck: true,
  jsx: TS.JsxEmit.ReactJSX,
  declaration: true,
  noImplicitAny: false,
  baseUrl: '/',
  paths: { '*': ['node_modules/*'] },
}

const virtualFiles: Record<string, { content: string; version: number }> = {}
let externalPackageDefinitions: Record<string, string> = {}
let externalPackageVersion = 0
let isEsbuildInitialized = false
let initPromise: Promise<void> | null = null

function normalizePath(path: string): string {
  const cleaned = path.replace(/^file:\/\/\//, '/')
  return cleaned.startsWith('/') ? cleaned : '/' + cleaned
}

function createConfigHost(): TS.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
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
    fileExists: (path) => {
      const normalized = normalizePath(path)
      if (normalized === '/main.d.ts') return false
      return !!(
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        normalized === '/main.ts' ||
        normalized === '/tsconfig.json'
      )
    },
    readFile: (path) => {
      const normalized = normalizePath(path)
      if (normalized === '/main.d.ts') return undefined
      return (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        (normalized === '/main.ts'
          ? virtualFiles['/main.ts']?.content
          : undefined)
      )
    },
  }
}

async function ensureInitialized(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (!isEsbuildInitialized) {
      try {
        await esbuild.initialize({ wasmURL: esbuildWasmUrl, worker: false })
        isEsbuildInitialized = true
      } catch (err) {
        console.error('esbuild initialization failed:', err)
        throw err
      }
    }
    await initializeLanguageService()
  })()
  return initPromise
}

async function initializeLanguageService() {
  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => {
      const libFiles = Object.keys(defaultLibraryFiles).map((f) => '/' + f)
      const externalFiles = Object.keys(externalPackageDefinitions).map(
        normalizePath
      )
      const filtered = externalFiles.filter(
        (f) => f !== '/main.ts' && f !== '/main.d.ts'
      )
      return ['/main.ts', ...libFiles, ...filtered]
    },
    getScriptVersion: (fileName) => {
      const normalized = normalizePath(fileName)
      if (normalized === '/main.ts')
        return String(virtualFiles['/main.ts']?.version ?? 0)
      if (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)]
      )
        return String(externalPackageVersion)
      return '0'
    },
    getScriptSnapshot: (fileName) => {
      const normalized = normalizePath(fileName)
      if (normalized === '/main.d.ts') return undefined
      let content: string | undefined
      if (normalized === '/main.ts') content = virtualFiles['/main.ts']?.content
      else if (defaultLibraryFiles[normalized.substring(1)])
        content = defaultLibraryFiles[normalized.substring(1)]
      else
        content =
          externalPackageDefinitions[normalized] ||
          externalPackageDefinitions[normalized.substring(1)]
      return content !== undefined
        ? TS.ScriptSnapshot.fromString(content)
        : undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: (path) => {
      const normalized = normalizePath(path)
      if (normalized === '/main.d.ts') return false
      return !!(
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)] ||
        defaultLibraryFiles[normalized.substring(1)] ||
        normalized === '/main.ts'
      )
    },
    readFile: (path) => {
      const normalized = normalizePath(path)
      if (normalized === '/main.d.ts') return undefined
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

// ── Custom messages ──
type CustomMessagePayload = {
  content?: string
  filename?: string
  libs?: Record<string, string>
  tsconfig?: string
  code?: string
}

async function handleCustomMessage(
  type: string,
  payload: unknown
): Promise<unknown> {
  const data = payload as CustomMessagePayload
  switch (type) {
    case 'UPDATE_FILE': {
      const { content = '', filename = '/main.ts' } = data
      const normalized = filename.startsWith('/') ? filename : '/' + filename
      // Add module marker to avoid global conflicts
      const hasModuleMarker = /^\s*(import|export)\s/m.test(content)
      const finalContent = hasModuleMarker
        ? content
        : content + '\nexport {};\n'
      const fileState = virtualFiles[normalized]
      if (!fileState || fileState.content !== finalContent) {
        virtualFiles[normalized] = {
          version: (fileState?.version || 0) + 1,
          content: finalContent,
        }
      }
      return true
    }
    case 'UPDATE_EXTRA_LIBS': {
      const rawLibs = data.libs ?? {}
      const wrappedLibs: Record<string, string> = {}
      for (const [path, content] of Object.entries(rawLibs)) {
        const isDeclarationFile = path.endsWith('.d.ts')
        const hasModuleMarker = /^\s*(import|export)\s/m.test(content)
        wrappedLibs[path] =
          isDeclarationFile && !hasModuleMarker
            ? content + '\nexport {};\n'
            : content
      }
      externalPackageDefinitions = wrappedLibs
      externalPackageVersion += 1
      if (virtualFiles['/main.ts']) virtualFiles['/main.ts'].version += 1
      return true
    }
    case 'UPDATE_CONFIG': {
      const { tsconfig = '' } = data
      const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig)
      if (parsed.error) return false
      const host = createConfigHost()
      const { options, errors } = TS.parseJsonConfigFileContent(
        parsed.config,
        host,
        '/'
      )
      if (errors.some((e) => e.code !== TS18003_NO_INPUTS)) return false
      compilerOptions = { ...compilerOptions, ...options }
      if (virtualFiles['/main.ts']) virtualFiles['/main.ts'].version += 1
      return true
    }
    case 'VALIDATE_CONFIG': {
      const { tsconfig = '' } = data
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
      const host = createConfigHost()
      const { errors } = TS.parseJsonConfigFileContent(parsed.config, host, '/')
      const fatal = errors.filter((e) => e.code !== TS18003_NO_INPUTS)
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
    case 'GET_DIAGNOSTICS': {
      if (!languageService) return []
      const syntactic = languageService.getSyntacticDiagnostics('/main.ts')
      const semantic = languageService.getSemanticDiagnostics('/main.ts')
      return [...syntactic, ...semantic].map((d) => ({
        start: d.start || 0,
        length: d.length || 0,
        message:
          typeof d.messageText === 'string'
            ? d.messageText
            : TS.flattenDiagnosticMessageText(d.messageText, '\n'),
        category:
          d.category === TS.DiagnosticCategory.Warning
            ? 'warning'
            : d.category === TS.DiagnosticCategory.Error
              ? 'error'
              : d.category === TS.DiagnosticCategory.Suggestion
                ? 'suggestion'
                : 'message',
        line:
          d.file && d.start !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start).line
            : 0,
        character:
          d.file && d.start !== undefined
            ? TS.getLineAndCharacterOfPosition(d.file, d.start).character
            : 0,
      }))
    }
    case 'COMPILE': {
      virtualFiles['/main.ts'] = {
        version: (virtualFiles['/main.ts']?.version || 0) + 1,
        content: data.code ?? '',
      }
      const compiled = await esbuild.build({
        bundle: false,
        format: 'esm',
        target: 'es2023',
        write: false,
        stdin: {
          contents: data.code ?? '',
          loader: 'ts',
          sourcefile: '/main.ts',
        },
      })
      let dts = ''
      if (languageService) {
        const output = languageService.getEmitOutput('/main.ts', true)
        const dtsFile = output.outputFiles.find((f) => f.name.endsWith('.d.ts'))
        if (dtsFile) dts = dtsFile.text
      }
      if (!dts) dts = generateAmbientDeclarations(data.code ?? '')
      return { js: compiled.outputFiles?.[0]?.text || '', dts }
    }
    case 'DETECT_IMPORTS': {
      const sourceFile = TS.createSourceFile(
        'temp.ts',
        data.code ?? '',
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

// ── Monaco worker protocol ──
async function handleMonacoMethod(
  method: string,
  args: unknown[],
  fileName?: string
): Promise<unknown> {
  switch (method) {
    case 'init':
      // Critical: respond synchronously
      return { success: true }
    case 'getDefaultLibFileName':
      return '/lib.es2020.d.ts'
    case 'getScriptFileNames': {
      const libFiles = Object.keys(defaultLibraryFiles).map((f) => '/' + f)
      const externalFiles = Object.keys(externalPackageDefinitions).map(
        normalizePath
      )
      const filtered = externalFiles.filter(
        (f) => f !== '/main.ts' && f !== '/main.d.ts'
      )
      return ['/main.ts', ...libFiles, ...filtered]
    }
    case 'getScriptVersion': {
      const normalized = normalizePath(fileName!)
      if (normalized === '/main.ts')
        return String(virtualFiles['/main.ts']?.version ?? 0)
      if (
        externalPackageDefinitions[normalized] ||
        externalPackageDefinitions[normalized.substring(1)]
      )
        return String(externalPackageVersion)
      return '0'
    }
    case 'getScriptSnapshot': {
      const path = normalizePath(fileName!)
      if (path === '/main.d.ts') return undefined
      let content: string | undefined
      if (path === '/main.ts') content = virtualFiles['/main.ts']?.content
      else if (defaultLibraryFiles[path.substring(1)])
        content = defaultLibraryFiles[path.substring(1)]
      else
        content =
          externalPackageDefinitions[path] ||
          externalPackageDefinitions[path.substring(1)]
      return content !== undefined
        ? TS.ScriptSnapshot.fromString(content)
        : undefined
    }
    case 'getDiagnostics': {
      if (!languageService) throw new Error('Undefined language service')
      const diags = [
        ...languageService.getSyntacticDiagnostics('/main.ts'),
        ...languageService.getSemanticDiagnostics('/main.ts'),
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
      if (!languageService) throw new Error('Undefined language service')
      return languageService.getCompletionsAtPosition(
        '/main.ts',
        args[0] as number,
        undefined
      )
    }
    case 'getQuickInfoAtPosition': {
      if (!languageService) throw new Error('Undefined language service')
      return languageService.getQuickInfoAtPosition(
        '/main.ts',
        args[0] as number
      )
    }
    case 'getEmitOutput': {
      if (!languageService) throw new Error('Undefined language service')
      return languageService.getEmitOutput('/main.ts', true)
    }
    default:
      throw new Error(`Unknown Monaco method: ${method}`)
  }
}

// ─── Main message handler ────────────────────────────────────────
globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload, method, args, fileName } = messageEvent.data
  try {
    // Monaco method
    if (method) {
      // For 'init', respond synchronously – no await
      if (method === 'init') {
        const result = await handleMonacoMethod(method, args, fileName)
        self.postMessage({ id, result })
        return
      }
      await ensureInitialized()
      const result = await handleMonacoMethod(method, args, fileName)
      self.postMessage({ id, result })
      return
    }
    // Custom message
    if (type === 'INIT') {
      await ensureInitialized()
      self.postMessage({ id, success: true, payload: true })
      return
    }
    await ensureInitialized()
    const result = await handleCustomMessage(type, payload)
    self.postMessage({ id, success: true, payload: result })
  } catch (error) {
    const message = getErrorMessage(error)
    if (method) {
      self.postMessage({ id, error: message })
    } else {
      self.postMessage({ id, success: false, error: message })
    }
  }
}
