/// <reference lib="webworker" />
/// <reference types="vite/client" />
import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'
import * as TS from 'typescript'
import lib_es5_d_ts from 'typescript/lib/lib.es5.d.ts?raw'
import lib_es2015_d_ts from 'typescript/lib/lib.es2015.d.ts?raw'
import lib_es2015_core_d_ts from 'typescript/lib/lib.es2015.core.d.ts?raw'
import lib_es2015_collection_d_ts from 'typescript/lib/lib.es2015.collection.d.ts?raw'
import lib_es2015_generator_d_ts from 'typescript/lib/lib.es2015.generator.d.ts?raw'
import lib_es2015_iterable_d_ts from 'typescript/lib/lib.es2015.iterable.d.ts?raw'
import lib_es2015_promise_d_ts from 'typescript/lib/lib.es2015.promise.d.ts?raw'
import lib_es2015_proxy_d_ts from 'typescript/lib/lib.es2015.proxy.d.ts?raw'
import lib_es2015_reflect_d_ts from 'typescript/lib/lib.es2015.reflect.d.ts?raw'
import lib_es2015_symbol_d_ts from 'typescript/lib/lib.es2015.symbol.d.ts?raw'
import lib_es2015_symbol_wellknown_d_ts from 'typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw'
import lib_es2016_d_ts from 'typescript/lib/lib.es2016.d.ts?raw'
import lib_es2016_array_include_d_ts from 'typescript/lib/lib.es2016.array.include.d.ts?raw'
import lib_es2017_d_ts from 'typescript/lib/lib.es2017.d.ts?raw'
import lib_es2017_date_d_ts from 'typescript/lib/lib.es2017.date.d.ts?raw'
import lib_es2017_object_d_ts from 'typescript/lib/lib.es2017.object.d.ts?raw'
import lib_es2017_sharedmemory_d_ts from 'typescript/lib/lib.es2017.sharedmemory.d.ts?raw'
import lib_es2017_string_d_ts from 'typescript/lib/lib.es2017.string.d.ts?raw'
import lib_es2017_intl_d_ts from 'typescript/lib/lib.es2017.intl.d.ts?raw'
import lib_es2017_typedarrays_d_ts from 'typescript/lib/lib.es2017.typedarrays.d.ts?raw'
import lib_es2018_d_ts from 'typescript/lib/lib.es2018.d.ts?raw'
import lib_es2018_asyncgenerator_d_ts from 'typescript/lib/lib.es2018.asyncgenerator.d.ts?raw'
import lib_es2018_asynciterable_d_ts from 'typescript/lib/lib.es2018.asynciterable.d.ts?raw'
import lib_es2018_intl_d_ts from 'typescript/lib/lib.es2018.intl.d.ts?raw'
import lib_es2018_promise_d_ts from 'typescript/lib/lib.es2018.promise.d.ts?raw'
import lib_es2018_regexp_d_ts from 'typescript/lib/lib.es2018.regexp.d.ts?raw'
import lib_es2019_d_ts from 'typescript/lib/lib.es2019.d.ts?raw'
import lib_es2019_array_d_ts from 'typescript/lib/lib.es2019.array.d.ts?raw'
import lib_es2019_object_d_ts from 'typescript/lib/lib.es2019.object.d.ts?raw'
import lib_es2019_string_d_ts from 'typescript/lib/lib.es2019.string.d.ts?raw'
import lib_es2019_symbol_d_ts from 'typescript/lib/lib.es2019.symbol.d.ts?raw'
import lib_es2019_intl_d_ts from 'typescript/lib/lib.es2019.intl.d.ts?raw'
import lib_es2020_d_ts from 'typescript/lib/lib.es2020.d.ts?raw'
import lib_es2020_bigint_d_ts from 'typescript/lib/lib.es2020.bigint.d.ts?raw'
import lib_es2020_date_d_ts from 'typescript/lib/lib.es2020.date.d.ts?raw'
import lib_es2020_promise_d_ts from 'typescript/lib/lib.es2020.promise.d.ts?raw'
import lib_es2020_sharedmemory_d_ts from 'typescript/lib/lib.es2020.sharedmemory.d.ts?raw'
import lib_es2020_string_d_ts from 'typescript/lib/lib.es2020.string.d.ts?raw'
import lib_es2020_symbol_wellknown_d_ts from 'typescript/lib/lib.es2020.symbol.wellknown.d.ts?raw'
import lib_es2020_intl_d_ts from 'typescript/lib/lib.es2020.intl.d.ts?raw'
import lib_es2020_number_d_ts from 'typescript/lib/lib.es2020.number.d.ts?raw'
import lib_dom_d_ts from 'typescript/lib/lib.dom.d.ts?raw'
import lib_dom_iterable_d_ts from 'typescript/lib/lib.dom.iterable.d.ts?raw'

let languageService: TS.LanguageService | undefined
let isEsbuildInitialized = false
let workerInitializationPromise: Promise<void> | undefined

const virtualFiles: Record<string, { version: number; content: string }> = {}
const defaultLibraryFiles: Record<string, { version: number; content: string }> = {}
let externalPackageDefinitions: Record<string, string> = {}

const embeddedTypeScriptLibraries: Record<string, string> = {
  'lib.es5.d.ts': lib_es5_d_ts,
  'lib.es2015.d.ts': lib_es2015_d_ts,
  'lib.es2015.core.d.ts': lib_es2015_core_d_ts,
  'lib.es2015.collection.d.ts': lib_es2015_collection_d_ts,
  'lib.es2015.generator.d.ts': lib_es2015_generator_d_ts,
  'lib.es2015.iterable.d.ts': lib_es2015_iterable_d_ts,
  'lib.es2015.promise.d.ts': lib_es2015_promise_d_ts,
  'lib.es2015.proxy.d.ts': lib_es2015_proxy_d_ts,
  'lib.es2015.reflect.d.ts': lib_es2015_reflect_d_ts,
  'lib.es2015.symbol.d.ts': lib_es2015_symbol_d_ts,
  'lib.es2015.symbol.wellknown.d.ts': lib_es2015_symbol_wellknown_d_ts,
  'lib.es2016.d.ts': lib_es2016_d_ts,
  'lib.es2016.array.include.d.ts': lib_es2016_array_include_d_ts,
  'lib.es2017.d.ts': lib_es2017_d_ts,
  'lib.es2017.date.d.ts': lib_es2017_date_d_ts,
  'lib.es2017.object.d.ts': lib_es2017_object_d_ts,
  'lib.es2017.sharedmemory.d.ts': lib_es2017_sharedmemory_d_ts,
  'lib.es2017.string.d.ts': lib_es2017_string_d_ts,
  'lib.es2017.intl.d.ts': lib_es2017_intl_d_ts,
  'lib.es2017.typedarrays.d.ts': lib_es2017_typedarrays_d_ts,
  'lib.es2018.d.ts': lib_es2018_d_ts,
  'lib.es2018.asyncgenerator.d.ts': lib_es2018_asyncgenerator_d_ts,
  'lib.es2018.asynciterable.d.ts': lib_es2018_asynciterable_d_ts,
  'lib.es2018.intl.d.ts': lib_es2018_intl_d_ts,
  'lib.es2018.promise.d.ts': lib_es2018_promise_d_ts,
  'lib.es2018.regexp.d.ts': lib_es2018_regexp_d_ts,
  'lib.es2019.d.ts': lib_es2019_d_ts,
  'lib.es2019.array.d.ts': lib_es2019_array_d_ts,
  'lib.es2019.object.d.ts': lib_es2019_object_d_ts,
  'lib.es2019.string.d.ts': lib_es2019_string_d_ts,
  'lib.es2019.symbol.d.ts': lib_es2019_symbol_d_ts,
  'lib.es2019.intl.d.ts': lib_es2019_intl_d_ts,
  'lib.es2020.d.ts': lib_es2020_d_ts,
  'lib.es2020.bigint.d.ts': lib_es2020_bigint_d_ts,
  'lib.es2020.date.d.ts': lib_es2020_date_d_ts,
  'lib.es2020.promise.d.ts': lib_es2020_promise_d_ts,
  'lib.es2020.sharedmemory.d.ts': lib_es2020_sharedmemory_d_ts,
  'lib.es2020.string.d.ts': lib_es2020_string_d_ts,
  'lib.es2020.symbol.wellknown.d.ts': lib_es2020_symbol_wellknown_d_ts,
  'lib.es2020.intl.d.ts': lib_es2020_intl_d_ts,
  'lib.es2020.number.d.ts': lib_es2020_number_d_ts,
  'lib.dom.d.ts': lib_dom_d_ts,
  'lib.dom.iterable.d.ts': lib_dom_iterable_d_ts,
}

const nodeEnvironmentDefinitions = `
declare var process: any;
declare var require: any;
declare var module: any;
declare var exports: any;
declare var __dirname: string;
declare var __filename: string;
declare var global: any;
declare var Buffer: any;
`

const defaultCompilerOptions: TS.CompilerOptions = {
  target: TS.ScriptTarget.ES2020,
  module: TS.ModuleKind.ESNext,
  moduleResolution: 100,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  lib: Object.keys(embeddedTypeScriptLibraries),
  esModuleInterop: true,
  strict: true,
  skipLibCheck: true,
  suppressExcessPropertyErrors: true,
  noImplicitAny: false,
}

let currentCompilerOptions: TS.CompilerOptions = { ...defaultCompilerOptions }
let parsedTypeScriptConfiguration: esbuild.TsconfigRaw | undefined

function loadDefaultTypeScriptLibraries() {
  for (const [fileName, content] of Object.entries(embeddedTypeScriptLibraries)) {
    if (content) defaultLibraryFiles[fileName] = { version: 1, content }
  }

  defaultLibraryFiles['node.d.ts'] = { version: 1, content: nodeEnvironmentDefinitions }
}

async function initializeLanguageService() {
  if (languageService) return

  const languageServiceHost: TS.LanguageServiceHost = {
    getScriptFileNames: () => [
      '/main.ts',
      ...Object.keys(defaultLibraryFiles).map((fileName) => `/${fileName}`),
      ...Object.keys(externalPackageDefinitions),
    ],
    getScriptVersion(fileName) {
      const normalizedPath = fileName.replace(/^\/+/, '')
      if (normalizedPath === 'main.ts')
        return String(virtualFiles['main.ts']?.version ?? 0)
      if (defaultLibraryFiles[normalizedPath]) return String(defaultLibraryFiles[normalizedPath].version)

      const isExternalLibrary = externalPackageDefinitions[fileName] !== undefined || externalPackageDefinitions['/' + normalizedPath] !== undefined
      if (isExternalLibrary) return '1'
      return '0'
    },
    getScriptSnapshot(fileName) {
      const normalizedPath = fileName.replace(/^\/+/, '')
      let content: string | undefined
      if (normalizedPath === 'main.ts') content = virtualFiles['main.ts']?.content
      else if (defaultLibraryFiles[normalizedPath]) content = defaultLibraryFiles[normalizedPath].content
      else if (externalPackageDefinitions[fileName] !== undefined) content = externalPackageDefinitions[fileName]
      else if (externalPackageDefinitions['/' + normalizedPath] !== undefined)
        content = externalPackageDefinitions['/' + normalizedPath]

      if (content !== undefined) return TS.ScriptSnapshot.fromString(content)
      return undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => currentCompilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists(fileName) {
      const normalizedPath = fileName.replace(/^\/+/, '')
      return (
        normalizedPath === 'main.ts' ||
        Boolean(defaultLibraryFiles[normalizedPath]) ||
        externalPackageDefinitions[fileName] !== undefined ||
        externalPackageDefinitions['/' + normalizedPath] !== undefined
      )
    },
    readFile(fileName) {
      const normalizedPath = fileName.replace(/^\/+/, '')
      if (normalizedPath === 'main.ts') return virtualFiles['main.ts']?.content
      if (defaultLibraryFiles[normalizedPath]) return defaultLibraryFiles[normalizedPath].content
      if (externalPackageDefinitions[fileName] !== undefined) return externalPackageDefinitions[fileName]
      if (externalPackageDefinitions['/' + normalizedPath] !== undefined)
        return externalPackageDefinitions['/' + normalizedPath]
      return undefined
    },
    directoryExists(directoryName) {
      if (directoryName === '/' || directoryName === '') return true
      const normalizedPath = '/' + directoryName.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      return Object.keys(externalPackageDefinitions).some((filePath) => filePath.startsWith(normalizedPath))
    },
    getDirectories(directoryName) {
      const normalizedPath = '/' + directoryName.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      const subDirectories = new Set<string>()
      for (const filePath of Object.keys(externalPackageDefinitions)) {
        if (filePath.startsWith(normalizedPath)) {
          const remainingPath = filePath.slice(normalizedPath.length)
          const firstPathSeparatorIndex = remainingPath.indexOf('/')
          if (firstPathSeparatorIndex !== -1) {
            subDirectories.add(remainingPath.slice(0, firstPathSeparatorIndex))
          }
        }
      }

      return [...subDirectories]
    },
    readDirectory(path, extensions, _exclude, _include, _depth) {
      const normalizedPath = path === '/' ? '/' : '/' + path.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      const matchedFiles: string[] = []

      for (const filePath of Object.keys(externalPackageDefinitions)) {
        if (filePath.startsWith(normalizedPath)) {
          const hasMatchingExtension = extensions && !extensions.some((extension) => filePath.endsWith(extension))
          if (hasMatchingExtension) continue
          matchedFiles.push(filePath)
        }
      }
      return matchedFiles
    },
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  }

  languageService = TS.createLanguageService(languageServiceHost, TS.createDocumentRegistry())
}

function extractClassDeclarationSkeleton(sourceLines: string[]): string[] {
  const skeletonLines: string[] = []
  const classSignatureLine = sourceLines[0].trim()
  const isExported = classSignatureLine.startsWith('export')
  const declarationPrefix = isExported ? 'export declare' : 'declare'
  const normalizedClassSignature = classSignatureLine
    .replace(/^export\s+/, '')
    .replace(
      /^(abstract\s+)?class/,
      `${declarationPrefix} $1class`.replaceAll(/\s+/g, ' ')
    )
  skeletonLines.push(normalizedClassSignature.includes('{') ? normalizedClassSignature : normalizedClassSignature + ' {')

  for (let i = 1; i < sourceLines.length - 1; i++) {
    const currentLine = sourceLines[i].trim()
    if (!currentLine || currentLine === '{' || currentLine === '}') continue

    const propertyMatch = /^(public|private|protected|readonly|static|\s)*(\w+)\s*[?!]?\s*:\s*([^;=]+)/.exec(currentLine)
    if (propertyMatch) {
      skeletonLines.push(`  ${propertyMatch[2]}: ${propertyMatch[3].trim()};`)
      continue
    }

    const methodMatch = /^(public|private|protected|static|async|\s)*(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?/.exec(currentLine)
    if (methodMatch) {
      const [, , methodName, generics, parameters, returnType] = methodMatch
      const isAsyncMethod = /\basync\s+/.test(currentLine)
      if (methodName === 'constructor') {
        skeletonLines.push(`  constructor(${parameters});`)
      } else {
        const effectiveReturnType = returnType?.trim() || (isAsyncMethod ? 'Promise<void>' : 'void')
        skeletonLines.push(`  ${methodName}${generics || ''}(${parameters}): ${effectiveReturnType};`)
      }

      if (currentLine.includes('{')) {
        let braceDepth = (currentLine.match(/{/g) || []).length - (currentLine.match(/}/g) || []).length
        while (braceDepth > 0 && i + 1 < sourceLines.length - 1) {
          i++
          braceDepth += (sourceLines[i].match(/{/g) || []).length
          braceDepth -= (sourceLines[i].match(/}/g) || []).length
        }
      }
    }
  }

  skeletonLines.push('}')
  return skeletonLines
}

function generateAmbientDeclarations(sourceCode: string): string {
  const sourceLines = sourceCode.split('\n')
  const ambientDeclarationLines: string[] = []
  let isInsideBlockComment = false
  let accumulatedJsDoc: string[] = []
  let currentBraceDepth = 0
  let isCapturingBlock = false
  let capturedBlockLines: string[] = []
  let capturedDeclarationType = ''

  for (let i = 0; i < sourceLines.length; i++) {
    const lineContent = sourceLines[i]
    const trimmedLine = lineContent.trim()

    if (isInsideBlockComment) {
      if (isCapturingBlock) capturedBlockLines.push(lineContent)
      else accumulatedJsDoc.push(lineContent)
      if (trimmedLine.includes('*/')) isInsideBlockComment = false
      continue
    }

    if (trimmedLine.startsWith('/*')) {
      isInsideBlockComment = true
      if (isCapturingBlock) capturedBlockLines.push(lineContent)
      else accumulatedJsDoc = [lineContent]
      if (trimmedLine.includes('*/')) isInsideBlockComment = false
      continue
    }

    if (isCapturingBlock) {
      capturedBlockLines.push(lineContent)
      currentBraceDepth += (lineContent.match(/{/g) || []).length
      currentBraceDepth -= (lineContent.match(/}/g) || []).length
      if (currentBraceDepth <= 0) {
        if (capturedDeclarationType === 'class') {
          ambientDeclarationLines.push(...accumulatedJsDoc)
          ambientDeclarationLines.push(...extractClassDeclarationSkeleton(capturedBlockLines))
        } else {
          ambientDeclarationLines.push(...accumulatedJsDoc, ...capturedBlockLines)
        }

        ambientDeclarationLines.push('')
        isCapturingBlock = false
        capturedBlockLines = []
        accumulatedJsDoc = []
        capturedDeclarationType = ''
      }

      continue
    }

    if (trimmedLine.startsWith('//')) continue
    if (!trimmedLine) continue
    const isImportOrRequire = trimmedLine.startsWith('import ') || trimmedLine.startsWith('require(')
    if (isImportOrRequire) continue

    const interfaceDeclarationMatch = /^(export\s+)?interface\s+/.test(trimmedLine)
    if (interfaceDeclarationMatch) {
      isCapturingBlock = true
      capturedDeclarationType = 'interface'
      capturedBlockLines = [lineContent]
      currentBraceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
      const isSingleLineInterface = currentBraceDepth <= 0 && lineContent.includes('}')
      if (isSingleLineInterface) {
        ambientDeclarationLines.push(...accumulatedJsDoc, lineContent, '')
        isCapturingBlock = false
        capturedBlockLines = []
        accumulatedJsDoc = []
      }

      continue
    }

    const typeAliasDeclarationMatch = /^(export\s+)?type\s+\w+/.test(trimmedLine)
    if (typeAliasDeclarationMatch) {
      ambientDeclarationLines.push(...accumulatedJsDoc)
      const isMultiLineTypeAlias = !trimmedLine.includes(';') && trimmedLine.includes('{')
      if (isMultiLineTypeAlias) {
        isCapturingBlock = true
        capturedDeclarationType = 'type'
        capturedBlockLines = [lineContent]
        currentBraceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
      } else {
        const ambientTypeAlias = trimmedLine.startsWith('export') ? lineContent : `export ${lineContent}`
        ambientDeclarationLines.push(ambientTypeAlias, '')
      }

      accumulatedJsDoc = []
      continue
    }

    const enumDeclarationMatch = /^(export\s+)?(const\s+)?enum\s+/.test(trimmedLine)
    if (enumDeclarationMatch) {
      isCapturingBlock = true
      capturedDeclarationType = 'enum'
      const exportedEnumLine = trimmedLine.startsWith('export') ? lineContent : `export ${lineContent}`
      capturedBlockLines = [exportedEnumLine.replace(/^(export\s+)?(const\s+)?enum/, 'declare enum')]
      currentBraceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
      continue
    }

    const classDeclarationMatch = /^(export\s+)?(abstract\s+)?class\s+/.test(trimmedLine)
    if (classDeclarationMatch) {
      isCapturingBlock = true
      capturedDeclarationType = 'class'
      capturedBlockLines = [lineContent]
      currentBraceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
      continue
    }

    const functionDeclarationMatch = /^(export\s+)?(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?/.exec(trimmedLine)
    if (functionDeclarationMatch) {
      const [, exportPrefix, isAsyncFunction, functionName, functionGenerics, functionParameters, functionReturnType] = functionDeclarationMatch
      const genericsString = functionGenerics || ''
      const effectiveReturnType = functionReturnType?.trim() || (isAsyncFunction ? 'Promise<void>' : 'void')
      const ambientPrefix = exportPrefix ? 'export declare' : 'declare'
      ambientDeclarationLines.push(
        ...accumulatedJsDoc,
        `${ambientPrefix} function ${functionName}${genericsString}(${functionParameters}): ${effectiveReturnType};`,
        ''
      )
      accumulatedJsDoc = []
      if (trimmedLine.includes('{')) {
        let braceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
        while (braceDepth > 0 && i + 1 < sourceLines.length) {
          i++
          braceDepth += (sourceLines[i].match(/{/g) || []).length
          braceDepth -= (sourceLines[i].match(/}/g) || []).length
        }
      }

      continue
    }

    const variableDeclarationMatch = /^(export\s+)?(const|let|var)\s+(\w+)\s*(?::\s*([^=]+?))?\s*=/.exec(trimmedLine)
    if (variableDeclarationMatch) {
      const [, exportPrefix, , variableName, explicitVariableType] = variableDeclarationMatch
      const ambientPrefix = exportPrefix ? 'export declare' : 'declare'

      if (explicitVariableType) {
        ambientDeclarationLines.push(...accumulatedJsDoc)
        ambientDeclarationLines.push(`${ambientPrefix} const ${variableName}: ${explicitVariableType.trim()};`, '')
      } else {
        const variableValueMatch = /=\s*(.+?)(?:;|$)/.exec(trimmedLine)
        if (variableValueMatch) {
          const variableValue = variableValueMatch[1].trim()
          let inferredType = 'unknown'
          if (/^["'`]/.test(variableValue)) inferredType = 'string'
          else if (/^\d/.test(variableValue)) inferredType = 'number'
          else if (variableValue === 'true' || variableValue === 'false') inferredType = 'boolean'
          else if (variableValue.startsWith('[')) inferredType = 'unknown[]'
          else if (variableValue.startsWith('{')) inferredType = 'Record<string, unknown>'
          else if (variableValue.startsWith('new ')) {
            const classNameMatch = /new\s+(\w+)/.exec(variableValue)
            inferredType = classNameMatch?.[1] || 'unknown'
          }

          const isArrowFunction = variableValue.includes('=>') || variableValue.startsWith('function') || variableValue.startsWith('async')
          if (isArrowFunction) {
            const arrowFunctionSignatureMatch = /(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+?))?\s*=>/.exec(variableValue)
            if (arrowFunctionSignatureMatch) {
              const arrowParameters = arrowFunctionSignatureMatch[1]
              const arrowReturnType = arrowFunctionSignatureMatch[2]?.trim() || 'void'
              const isAsyncArrow = variableValue.startsWith('async')
              const effectiveArrowReturnType = isAsyncArrow && !arrowReturnType.startsWith('Promise') ? `Promise<${arrowReturnType}>` : arrowReturnType
              ambientDeclarationLines.push(
                ...accumulatedJsDoc,
                `${ambientPrefix} const ${variableName}: (${arrowParameters}) => ${effectiveArrowReturnType};`,
                ''
              )
              accumulatedJsDoc = []
              if (trimmedLine.includes('{')) {
                let braceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
                while (braceDepth > 0 && i + 1 < sourceLines.length) {
                  i++
                  braceDepth += (sourceLines[i].match(/{/g) || []).length
                  braceDepth -= (sourceLines[i].match(/}/g) || []).length
                }
              }

              continue
            }
          }

          ambientDeclarationLines.push(
            ...accumulatedJsDoc,
            `${ambientPrefix} const ${variableName}: ${inferredType};`,
            ''
          )
        }
      }

      accumulatedJsDoc = []
      const isMultiLineVariableDeclaration = trimmedLine.includes('{') && !trimmedLine.includes('}')
      if (isMultiLineVariableDeclaration) {
        let braceDepth = (lineContent.match(/{/g) || []).length - (lineContent.match(/}/g) || []).length
        while (braceDepth > 0 && i + 1 < sourceLines.length) {
          i++
          braceDepth += (sourceLines[i].match(/{/g) || []).length
          braceDepth -= (sourceLines[i].match(/}/g) || []).length
        }
      }

      continue
    }

    accumulatedJsDoc = []
  }

  const generatedDeclarationsContent = ambientDeclarationLines.join('\n').trim()
  return generatedDeclarationsContent || '// No exported declarations found'
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload } = messageEvent.data
  try {
    let result: any

    switch (type) {
      case 'INIT': {
        workerInitializationPromise ||= (async () => {
          loadDefaultTypeScriptLibraries()
          if (!isEsbuildInitialized) {
            await esbuild.initialize({
              wasmURL: esbuildWasmUrl,
              worker: false,
            })
            isEsbuildInitialized = true
          }

          await initializeLanguageService()
        })()
        await workerInitializationPromise
        result = true
        break
      }

      case 'UPDATE_FILE': {
        const { filename, content } = payload
        const normalizedFileName = filename.replace(/^\/+/, '')
        const fileState = virtualFiles[normalizedFileName]
        if (!fileState || fileState.content !== content) {
          virtualFiles[normalizedFileName] = {
            version: (fileState?.version || 0) + 1,
            content,
          }
        }

        result = true
        break
      }

      case 'UPDATE_EXTRA_LIBS': {
        externalPackageDefinitions = payload.libs
        const mainTsFile = virtualFiles['main.ts']
        if (mainTsFile) {
          mainTsFile.version += 1
        }
        result = true
        break
      }

      case 'UPDATE_CONFIG': {
        try {
          const { config, error } = TS.parseConfigFileTextToJson('tsconfig.json', payload.tsconfig)
          if (error) throw new Error('Invalid config')

          parsedTypeScriptConfiguration = config

          const { options } = TS.convertCompilerOptionsFromJson(config?.compilerOptions || {}, '/')
          currentCompilerOptions = {
            ...defaultCompilerOptions,
            ...options,
            moduleResolution: 100,
            allowImportingTsExtensions: true,
          }
        } catch {
          currentCompilerOptions = { ...defaultCompilerOptions }
          parsedTypeScriptConfiguration = undefined
        }

        const mainTsFile = virtualFiles['main.ts']
        if (mainTsFile) {
          mainTsFile.version += 1
        }

        result = true
        break
      }

      case 'VALIDATE_CONFIG': {
        const { error } = TS.parseConfigFileTextToJson('tsconfig.json', payload.tsconfig)
        if (error) {
          let errorMessage = 'Invalid JSON'
          try {
            errorMessage = TS.flattenDiagnosticMessageText(error.messageText, '\n')
          } catch {
            errorMessage = String(error.messageText)
          }
          result = { valid: false, error: errorMessage }
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

        const syntacticDiagnostics = languageService.getSyntacticDiagnostics('main.ts') || []
        const semanticDiagnostics = languageService.getSemanticDiagnostics('main.ts') || []
        const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics]
        const ignoredDiagnosticCodes = new Set([1128, 2308])
        const filteredDiagnostics = allDiagnostics.filter((diagnostic) => !ignoredDiagnosticCodes.has(diagnostic.code))

        const mainTsContent = virtualFiles['main.ts']?.content || ''
        const lineStartPositions = [0]
        for (let i = 0; i < mainTsContent.length; i++) {
          if (mainTsContent[i] === '\n') lineStartPositions.push(i + 1)
        }

        result = filteredDiagnostics.map((diagnostic) => {
          const startPosition = diagnostic.start || 0
          let low = 0
          let high = lineStartPositions.length - 1
          while (low <= high) {
            const middle = (low + high) >> 1
            if (lineStartPositions[middle] <= startPosition) low = middle + 1
            else high = middle - 1
          }

          const lineNumber = high
          const characterPosition = startPosition - lineStartPositions[lineNumber]

          let flattenedMessage = 'Unknown error'
          try {
            flattenedMessage = TS.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
          } catch {
            flattenedMessage = String(diagnostic.messageText)
          }

          return {
            start: startPosition,
            length: diagnostic.length || 0,
            message: flattenedMessage,
            category: diagnostic.category === TS.DiagnosticCategory.Warning ? 'warning' : 'error',
            line: lineNumber,
            character: characterPosition,
          }
        })
        break
      }

      case 'GET_TYPE_INFO': {
        if (!languageService) {
          result = undefined
          break
        }

        const quickInfo = languageService.getQuickInfoAtPosition('main.ts', payload.offset)
        if (!quickInfo) {
          result = undefined
          break
        }

        const typeDisplayString = TS.displayPartsToString(quickInfo.displayParts)
        let documentationString = quickInfo.documentation ? TS.displayPartsToString(quickInfo.documentation) : ''

        if (quickInfo.tags) {
          const tagsString = quickInfo.tags
            .map((tag) => {
              const tagText = TS.displayPartsToString(tag.text)
              return `@${tag.name}${tagText ? ' ' + tagText : ''}`
            })
            .join('\n')
          if (documentationString) documentationString += '\n\n' + tagsString
          else documentationString = tagsString
        }

        const validNameKinds = [
          'localName', 'variableName', 'parameterName', 'methodName', 'functionName',
          'className', 'interfaceName', 'aliasName', 'propertyName', 'enumName',
          'enumMemberName', 'moduleName', 'typeParameterName'
        ]
        const namePart = quickInfo.displayParts?.find((part) => validNameKinds.includes(part.kind))

        result = {
          name: namePart ? namePart.text : '',
          kind: quickInfo.kind,
          typeAnnotation: typeDisplayString,
          jsDoc: documentationString || undefined,
        }
        break
      }

      case 'GET_COMPLETIONS': {
        if (!languageService) {
          result = []
          break
        }

        const completionInfo = languageService.getCompletionsAtPosition('main.ts', payload.offset, undefined)
        if (!completionInfo) {
          result = []
          break
        }

        result = completionInfo.entries.map((entry) => ({
          name: entry.name,
          kind: entry.kind,
          insertText: entry.insertText,
        }))
        break
      }

      case 'COMPILE': {
        if (workerInitializationPromise) await workerInitializationPromise
        if (!isEsbuildInitialized) throw new Error('esbuild not initialized')

        const esbuildResult = await esbuild.build({
          bundle: false,
          format: 'esm',
          target: 'es2020',
          tsconfigRaw: parsedTypeScriptConfiguration,
          write: false,
          sourcemap: false,
          stdin: {
            contents: payload.code,
            loader: 'ts',
            sourcefile: 'main.ts',
          },
        })

        const compiledJavaScript = esbuildResult.outputFiles?.[0]?.text || ''
        const generatedDeclarations = generateAmbientDeclarations(payload.code)
        result = { js: compiledJavaScript, dts: generatedDeclarations }
        break
      }

      case 'DETECT_IMPORTS': {
        if (workerInitializationPromise) await workerInitializationPromise
        const sourceFile = TS.createSourceFile('temp.ts', payload.code, TS.ScriptTarget.Latest, true)
        const detectedImportNames = new Set<string>()

        const nodeBuiltinModules = new Set([
          'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
          'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'fs/promises',
          'http', 'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'path/posix',
          'path/win32', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline', 'repl',
          'stream', 'stream/promises', 'stream/consumers', 'stream/web', 'string_decoder', 'sys',
          'timers', 'timers/promises', 'tls', 'trace_events', 'tty', 'url', 'util', 'util/types',
          'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
        ])

        const extractModuleFromNode = (node: TS.Node) => {
          if (TS.isImportDeclaration(node)) {
            const moduleSpecifier = (node.moduleSpecifier as TS.StringLiteral)?.text
            if (moduleSpecifier && !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/') && !moduleSpecifier.startsWith('http')) {
              const pathParts = moduleSpecifier.split('/')
              const packageName = moduleSpecifier.startsWith('@') ? `${pathParts[0]}/${pathParts[1]}` : pathParts[0]
              const isNotBuiltin = packageName && !nodeBuiltinModules.has(packageName) && !packageName.startsWith('node:')
              if (isNotBuiltin) {
                detectedImportNames.add(packageName)
              }
            }
          } else if (TS.isCallExpression(node) && node.expression.kind === TS.SyntaxKind.ImportKeyword) {
            const firstArgument = node.arguments[0]
            if (firstArgument && TS.isStringLiteral(firstArgument)) {
              const moduleSpecifier = firstArgument.text
              if (moduleSpecifier && !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/') && !moduleSpecifier.startsWith('http')) {
                const pathParts = moduleSpecifier.split('/')
                const packageName = moduleSpecifier.startsWith('@') ? `${pathParts[0]}/${pathParts[1]}` : pathParts[0]
                const isNotBuiltin = packageName && !nodeBuiltinModules.has(packageName) && !packageName.startsWith('node:')
                if (isNotBuiltin) {
                  detectedImportNames.add(packageName)
                }
              }
            }
          }

          TS.forEachChild(node, extractModuleFromNode)
        }

        extractModuleFromNode(sourceFile)
        result = [...detectedImportNames]
        break
      }

      default: {
        throw new Error(`Unknown worker message type: ${type}`)
      }
    }

    self.postMessage({ id, success: true, payload: result })
  } catch (error) {
    self.postMessage({ id, success: false, error: getErrorMessage(error) })
  }
}
