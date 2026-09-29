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

// "No inputs were found in config file" — expected in virtual filesystem
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
  const isAlreadyAbsolutePath = cleaned.startsWith('/')
  return isAlreadyAbsolutePath ? cleaned : '/' + cleaned
}

function isKnownSourceFile(path: string): boolean {
  const normalized = normalizePath(path)
  const isExternalPackage = Boolean(
    externalPackageDefinitions[normalized] ||
      externalPackageDefinitions[normalized.substring(1)]
  )
  const isDefaultLibrary = Boolean(defaultLibraryFiles[normalized.substring(1)])
  const isMainFile = normalized === '/main.ts'

  return isExternalPackage || isDefaultLibrary || isMainFile
}

function readVirtualFile(path: string): string | undefined {
  const normalized = normalizePath(path)
  const isDtsFile = normalized === '/main.d.ts'
  if (isDtsFile) return undefined

  const isMainFile = normalized === '/main.ts'
  const mainFileContent = isMainFile ? virtualFiles['/main.ts']?.content : undefined

  return (
    externalPackageDefinitions[normalized] ||
    externalPackageDefinitions[normalized.substring(1)] ||
    defaultLibraryFiles[normalized.substring(1)] ||
    mainFileContent
  )
}

function readVirtualDirectory(
  path: string,
  extensions?: readonly string[]
): string[] {
  const normalizedPath = path.endsWith('/') ? path : path + '/'
  const searchPath = normalizedPath.startsWith('/')
    ? normalizedPath.substring(1)
    : normalizedPath
  return Object.keys(externalPackageDefinitions)
    .filter(
      (file) =>
        file.startsWith(searchPath) &&
        (!extensions || extensions.some((ext) => file.endsWith(ext)))
    )
    .map(normalizePath)
}

function getScriptFileNames(): string[] {
  const libFiles = Object.keys(defaultLibraryFiles).map((file) => '/' + file)
  const externalFiles = Object.keys(externalPackageDefinitions).map(
    normalizePath
  )
  const filteredExternalFiles = externalFiles.filter(
    (file) => file !== '/main.ts' && file !== '/main.d.ts'
  )
  return ['/main.ts', ...libFiles, ...filteredExternalFiles]
}

function scriptVersionFor(fileName: string): string {
  const normalized = normalizePath(fileName)
  const isMainFile = normalized === '/main.ts'
  if (isMainFile) return String(virtualFiles['/main.ts']?.version ?? 0)

  const isExternalPackage = Boolean(
    externalPackageDefinitions[normalized] ||
      externalPackageDefinitions[normalized.substring(1)]
  )
  if (isExternalPackage) return String(externalPackageVersion)

  return '0'
}

function snapshotFor(fileName: string): TS.IScriptSnapshot | undefined {
  const normalized = normalizePath(fileName)
  const isDtsFile = normalized === '/main.d.ts'
  if (isDtsFile) return undefined

  let content: string | undefined
  const isMainFile = normalized === '/main.ts'
  const defaultLibContent = defaultLibraryFiles[normalized.substring(1)]

  if (isMainFile) {
    content = virtualFiles['/main.ts']?.content
  } else if (defaultLibContent) {
    content = defaultLibContent
  } else {
    content =
      externalPackageDefinitions[normalized] ||
      externalPackageDefinitions[normalized.substring(1)]
  }

  const hasContent = content !== undefined
  return hasContent ? TS.ScriptSnapshot.fromString(content) : undefined
}

function createConfigHost(): TS.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    readDirectory: (path, extensions) => readVirtualDirectory(path, extensions),
    fileExists: (path) =>
      isKnownSourceFile(path) || normalizePath(path) === '/tsconfig.json',
    readFile: readVirtualFile,
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
    getScriptFileNames,
    getScriptVersion: scriptVersionFor,
    getScriptSnapshot: snapshotFor,
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: isKnownSourceFile,
    readFile: readVirtualFile,
    readDirectory: (path, extensions) => readVirtualDirectory(path, extensions),
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
      .filter((line) => line.startsWith('export'))
      .join('\n')
  )
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

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
      const hasModuleMarker = /^\s*(import|export)\s/m.test(content)
      const finalContent = hasModuleMarker
        ? content
        : content + '\nexport {};\n'
      const fileState = virtualFiles[normalized]
      const needsUpdate = !fileState || fileState.content !== finalContent
      if (needsUpdate) {
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
        const needsExport = isDeclarationFile && !hasModuleMarker
        wrappedLibs[path] = needsExport ? content + '\nexport {};\n' : content
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
      const hasFatalErrors = errors.some((e) => e.code !== TS18003_NO_INPUTS)
      if (hasFatalErrors) return false
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
      const fatalErrors = errors.filter((e) => e.code !== TS18003_NO_INPUTS)
      if (fatalErrors.length > 0) {
        return {
          valid: false,
          error: fatalErrors
            .map((e) => TS.flattenDiagnosticMessageText(e.messageText, '\n'))
            .join('\n'),
        }
      }
      return { valid: true }
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

      const dtsIsModule = /^\s*(import|export)\s/m.test(dts)
      if (!dtsIsModule) dts = dts + '\nexport {};\n'
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
        const isImportDecl =
          TS.isImportDeclaration(node) &&
          TS.isStringLiteral(node.moduleSpecifier)
        if (isImportDecl) {
          const specifier = (node.moduleSpecifier as TS.StringLiteral).text
          const isExternalPackage =
            !specifier.startsWith('.') && !specifier.startsWith('/')
          if (isExternalPackage) {
            const parts = specifier.split('/')
            const pkgName = specifier.startsWith('@')
              ? `${parts[0]}/${parts[1]}`
              : parts[0] || ''
            imports.add(pkgName)
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

async function handleMonacoMethod(
  method: string,
  args: unknown[],
  fileName?: string
): Promise<unknown> {
  switch (method) {
    case 'init':
      return { success: true }
    case 'getDefaultLibFileName':
      return '/lib.es2020.d.ts'
    case 'getScriptFileNames':
      return getScriptFileNames()
    case 'getScriptVersion':
      return scriptVersionFor(fileName!)
    case 'getScriptSnapshot':
      return snapshotFor(fileName!)
    case 'getDiagnostics': {
      if (!languageService) throw new Error('Undefined language service')
      const diags = [
        ...languageService.getSyntacticDiagnostics('/main.ts'),
        ...languageService.getSemanticDiagnostics('/main.ts'),
      ]
      return diags.map((d) => {
        const hasStart = d.file && d.start !== undefined
        const hasLength = hasStart && d.length !== undefined
        const startPos = hasStart
          ? TS.getLineAndCharacterOfPosition(d.file!, d.start!)
          : null
        const endPos = hasLength
          ? TS.getLineAndCharacterOfPosition(d.file!, d.start! + d.length!)
          : null

        const severity =
          d.category === TS.DiagnosticCategory.Error
            ? 8
            : d.category === TS.DiagnosticCategory.Warning
              ? 4
              : 2

        const messageText =
          typeof d.messageText === 'string'
            ? d.messageText
            : TS.flattenDiagnosticMessageText(d.messageText, '\n')

        return {
          start: d.start ?? 0,
          length: d.length ?? 0,
          severity,
          message: messageText,
          startLineNumber: startPos ? startPos.line + 1 : 1,
          startColumn: startPos ? startPos.character + 1 : 1,
          endLineNumber: endPos ? endPos.line + 1 : 1,
          endColumn: endPos ? endPos.character + 1 : 1,
          source: 'typescript',
          code: d.code,
        }
      })
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

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload, method, args, fileName } = messageEvent.data
  try {
    if (method) {
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
