/// <reference lib="webworker" />
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

let ls: TS.LanguageService | undefined
let esbuildReady = false
let globalInitPromise: Promise<void> | undefined

const files: Record<string, { version: number; content: string }> = {}
const libFiles: Record<string, { version: number; content: string }> = {}
let extraLibs: Record<string, string> = {}

const rawLibs: Record<string, string> = {
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

const node_d_ts = `
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
  moduleResolution: 100, // TS.ModuleResolutionKind.Bundler
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  lib: Object.keys(rawLibs),
  esModuleInterop: true,
  strict: true,
  skipLibCheck: true,
  suppressExcessPropertyErrors: true,
  noImplicitAny: false,
}

let currentCompilerOptions: TS.CompilerOptions = { ...defaultCompilerOptions }

function ensureRequiredLibsLoaded() {
  for (const [fileName, content] of Object.entries(rawLibs)) {
    if (content) libFiles[fileName] = { version: 1, content }
  }

  libFiles['node.d.ts'] = { version: 1, content: node_d_ts }
}

async function initLanguageService() {
  if (ls) return

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [
      '/main.ts',
      ...Object.keys(libFiles).map((n) => `/${n}`),
      ...Object.keys(extraLibs),
    ],
    getScriptVersion(fileName) {
      const normalized = fileName.replace(/^\/+/, '')
      if (normalized === 'main.ts')
        return String(files['main.ts']?.version ?? 0)
      if (libFiles[normalized]) return String(libFiles[normalized].version)
      if (extraLibs[fileName]) return String(extraLibs[fileName].length)
      if (extraLibs['/' + normalized])
        return String(extraLibs['/' + normalized].length)
      return '0'
    },
    getScriptSnapshot(fileName) {
      const normalized = fileName.replace(/^\/+/, '')
      let content: string | undefined
      if (normalized === 'main.ts') content = files['main.ts']?.content
      else if (libFiles[normalized]) content = libFiles[normalized].content
      else if (extraLibs[fileName] !== undefined) content = extraLibs[fileName]
      else if (extraLibs['/' + normalized] !== undefined)
        content = extraLibs['/' + normalized]

      if (content !== undefined) return TS.ScriptSnapshot.fromString(content)
      return undefined
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => currentCompilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists(fileName) {
      const normalized = fileName.replace(/^\/+/, '')
      return (
        normalized === 'main.ts' ||
        Boolean(libFiles[normalized]) ||
        extraLibs[fileName] !== undefined ||
        extraLibs['/' + normalized] !== undefined
      )
    },
    readFile(fileName) {
      const normalized = fileName.replace(/^\/+/, '')
      if (normalized === 'main.ts') return files['main.ts']?.content
      if (libFiles[normalized]) return libFiles[normalized].content
      if (extraLibs[fileName] !== undefined) return extraLibs[fileName]
      if (extraLibs['/' + normalized] !== undefined)
        return extraLibs['/' + normalized]
      return undefined
    },
    // Crucial for module resolution to traverse virtual node_modules
    directoryExists(dirName) {
      if (dirName === '/' || dirName === '') return true
      const normalized =
        '/' + dirName.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      return Object.keys(extraLibs).some((path) => path.startsWith(normalized))
    },
    getDirectories(dirName) {
      const normalized =
        '/' + dirName.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      const dirs = new Set<string>()
      for (const path of Object.keys(extraLibs)) {
        if (path.startsWith(normalized)) {
          const rest = path.slice(normalized.length)
          const nextSlash = rest.indexOf('/')
          if (nextSlash !== -1) {
            dirs.add(rest.slice(0, nextSlash))
          }
        }
      }

      return [...dirs]
    },
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  }

  ls = TS.createLanguageService(host, TS.createDocumentRegistry())
}

function extractClassDeclaration(lines: string[]): string[] {
  const result: string[] = []
  const firstLine = lines[0].trim()
  const isExport = firstLine.startsWith('export')
  const prefix = isExport ? 'export declare' : 'declare'
  const cleaned = firstLine
    .replace(/^export\s+/, '')
    .replace(
      /^(abstract\s+)?class/,
      `${prefix} $1class`.replaceAll(/\s+/g, ' ')
    )
  result.push(cleaned.includes('{') ? cleaned : cleaned + ' {')

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i].trim()
    if (!line || line === '{' || line === '}') continue

    const propMatch =
      /^(public|private|protected|readonly|static|\s)*(\w+)\s*[?!]?\s*:\s*([^;=]+)/.exec(
        line
      )
    if (propMatch) {
      result.push(`  ${propMatch[2]}: ${propMatch[3].trim()};`)
      continue
    }

    const methMatch =
      /^(public|private|protected|static|async|\s)*(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?/.exec(
        line
      )
    if (methMatch) {
      const [, , name, gen, parameters, returnValue] = methMatch
      const isAsync = /\basync\s+/.test(line)
      if (name === 'constructor') {
        result.push(`  constructor(${parameters});`)
      } else {
        const finalReturnValue =
          returnValue?.trim() || (isAsync ? 'Promise<void>' : 'void')
        result.push(
          `  ${name}${gen || ''}(${parameters}): ${finalReturnValue};`
        )
      }

      if (line.includes('{')) {
        let depth =
          (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
        while (depth > 0 && i + 1 < lines.length - 1) {
          i++
          depth += (lines[i].match(/{/g) || []).length
          depth -= (lines[i].match(/}/g) || []).length
        }
      }
    }
  }

  result.push('}')
  return result
}

function generateDeclarations(code: string): string {
  const lines = code.split('\n')
  const dtsLines: string[] = []
  let inBlockComment = false
  let pendingJsDoc: string[] = []
  let braceDepth = 0
  let capturing = false
  let captureLines: string[] = []
  let captureType = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (inBlockComment) {
      if (capturing) captureLines.push(line)
      else pendingJsDoc.push(line)
      if (trimmed.includes('*/')) inBlockComment = false
      continue
    }

    if (trimmed.startsWith('/*')) {
      inBlockComment = true
      if (capturing) captureLines.push(line)
      else pendingJsDoc = [line]
      if (trimmed.includes('*/')) inBlockComment = false
      continue
    }

    if (capturing) {
      captureLines.push(line)
      braceDepth += (line.match(/{/g) || []).length
      braceDepth -= (line.match(/}/g) || []).length
      if (braceDepth <= 0) {
        if (captureType === 'class') {
          dtsLines.push(...pendingJsDoc)
          dtsLines.push(...extractClassDeclaration(captureLines))
        } else {
          dtsLines.push(...pendingJsDoc, ...captureLines)
        }

        dtsLines.push('')
        capturing = false
        captureLines = []
        pendingJsDoc = []
        captureType = ''
      }

      continue
    }

    if (trimmed.startsWith('//')) continue
    if (!trimmed) continue
    if (trimmed.startsWith('import ') || trimmed.startsWith('require('))
      continue

    if (/^(export\s+)?interface\s+/.test(trimmed)) {
      capturing = true
      captureType = 'interface'
      captureLines = [line]
      braceDepth =
        (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      if (braceDepth <= 0 && line.includes('}')) {
        dtsLines.push(...pendingJsDoc, line, '')
        capturing = false
        captureLines = []
        pendingJsDoc = []
      }

      continue
    }

    if (/^(export\s+)?type\s+\w+/.test(trimmed)) {
      dtsLines.push(...pendingJsDoc)
      if (!trimmed.includes(';') && trimmed.includes('{')) {
        capturing = true
        captureType = 'type'
        captureLines = [line]
        braceDepth =
          (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      } else {
        dtsLines.push(
          trimmed.startsWith('export') ? line : `export ${line}`,
          ''
        )
      }

      pendingJsDoc = []
      continue
    }

    if (/^(export\s+)?(const\s+)?enum\s+/.test(trimmed)) {
      capturing = true
      captureType = 'enum'
      const declLine = trimmed.startsWith('export') ? line : `export ${line}`
      captureLines = [
        declLine.replace(/^(export\s+)?(const\s+)?enum/, 'declare enum'),
      ]
      braceDepth =
        (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      continue
    }

    if (/^(export\s+)?(abstract\s+)?class\s+/.test(trimmed)) {
      capturing = true
      captureType = 'class'
      captureLines = [line]
      braceDepth =
        (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
      continue
    }

    const fnMatch =
      /^(export\s+)?(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?/.exec(
        trimmed
      )
    if (fnMatch) {
      const [, exp, isAsync, name, generics, parameters, returnType] = fnMatch
      const gen = generics || ''
      const returnValue =
        returnType?.trim() || (isAsync ? 'Promise<void>' : 'void')
      const prefix = exp ? 'export declare' : 'declare'
      dtsLines.push(
        ...pendingJsDoc,
        `${prefix} function ${name}${gen}(${parameters}): ${returnValue};`,
        ''
      )
      pendingJsDoc = []
      if (trimmed.includes('{')) {
        let depth =
          (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
        while (depth > 0 && i + 1 < lines.length) {
          i++
          depth += (lines[i].match(/{/g) || []).length
          depth -= (lines[i].match(/}/g) || []).length
        }
      }

      continue
    }

    const constMatch =
      /^(export\s+)?(const|let|var)\s+(\w+)\s*(?::\s*([^=]+?))?\s*=/.exec(
        trimmed
      )
    if (constMatch) {
      const [, exp, _kind, name, explicitType] = constMatch
      const prefix = exp ? 'export declare' : 'declare'

      if (explicitType) {
        dtsLines.push(...pendingJsDoc)
        dtsLines.push(`${prefix} const ${name}: ${explicitType.trim()};`, '')
      } else {
        const valueMatch = /=\s*(.+?)(?:;|$)/.exec(trimmed)
        if (valueMatch) {
          const value = valueMatch[1].trim()
          let inferredType = 'unknown'
          if (/^["'`]/.test(value)) inferredType = 'string'
          else if (/^\d/.test(value)) inferredType = 'number'
          else if (value === 'true' || value === 'false')
            inferredType = 'boolean'
          else if (value.startsWith('[')) inferredType = 'unknown[]'
          else if (value.startsWith('{'))
            inferredType = 'Record<string, unknown>'
          else if (value.startsWith('new ')) {
            const className = /new\s+(\w+)/.exec(value)?.[1]
            inferredType = className || 'unknown'
          }

          if (
            value.includes('=>') ||
            value.startsWith('function') ||
            value.startsWith('async')
          ) {
            const arrowMatch =
              /(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+?))?\s*=>/.exec(value)
            if (arrowMatch) {
              const aParameters = arrowMatch[1]
              const aReturnValue = arrowMatch[2]?.trim() || 'void'
              const isAsync = value.startsWith('async')
              const returnValueType =
                isAsync && !aReturnValue.startsWith('Promise')
                  ? `Promise<${aReturnValue}>`
                  : aReturnValue
              dtsLines.push(
                ...pendingJsDoc,
                `${prefix} const ${name}: (${aParameters}) => ${returnValueType};`,
                ''
              )
              pendingJsDoc = []
              if (trimmed.includes('{')) {
                let depth =
                  (line.match(/{/g) || []).length -
                  (line.match(/}/g) || []).length
                while (depth > 0 && i + 1 < lines.length) {
                  i++
                  depth += (lines[i].match(/{/g) || []).length
                  depth -= (lines[i].match(/}/g) || []).length
                }
              }

              continue
            }
          }

          dtsLines.push(
            ...pendingJsDoc,
            `${prefix} const ${name}: ${inferredType};`,
            ''
          )
        }
      }

      pendingJsDoc = []
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        let depth =
          (line.match(/{/g) || []).length - (line.match(/}/g) || []).length
        while (depth > 0 && i + 1 < lines.length) {
          i++
          depth += (lines[i].match(/{/g) || []).length
          depth -= (lines[i].match(/}/g) || []).length
        }
      }

      continue
    }

    pendingJsDoc = []
  }

  return dtsLines.join('\n').trim() || '// No exported declarations found'
}

const getErrorMessage = (e: unknown) => e instanceof Error ? e.message : String(e)

globalThis.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data
  try {
    let result: any

    switch (type) {
      case 'INIT': {
        globalInitPromise ||= (async () => {
          ensureRequiredLibsLoaded()
          if (!esbuildReady) {
            await esbuild.initialize({
              wasmURL: esbuildWasmUrl,
              worker: false,
            })
            esbuildReady = true
          }

          await initLanguageService()
        })()
        await globalInitPromise
        result = true
        break
      }

      case 'UPDATE_FILE': {
        const { filename, content } = payload
        const normalized = filename.replace(/^\/+/, '')
        if (files[normalized]?.content !== content) {
          files[normalized] = {
            version: (files[normalized]?.version || 0) + 1,
            content,
          }
        }

        result = true
        break
      }

      case 'UPDATE_EXTRA_LIBS': {
        extraLibs = payload.libs
        result = true
        break
      }

      case 'UPDATE_CONFIG': {
        try {
          const parsed = JSON.parse(payload.tsconfig)
          const { options } = TS.convertCompilerOptionsFromJson(
            parsed.compilerOptions || {},
            '/'
          )
          currentCompilerOptions = {
            ...defaultCompilerOptions,
            ...options,
            // Force these to ensure the playground doesn't break
            moduleResolution: 100,
            allowImportingTsExtensions: true,
          }
        } catch {
          // Fallback to default if JSON is invalid
          currentCompilerOptions = { ...defaultCompilerOptions }
        }

        // Force a version bump on main.ts to trigger re-evaluation with new options
        if (files['main.ts']) {
          files['main.ts'].version += 1
        }

        result = true
        break
      }

      case 'GET_DIAGNOSTICS': {
        if (!ls) {
          result = []
          break
        }

        const syntactic = ls.getSyntacticDiagnostics('main.ts') || []
        const semantic = ls.getSemanticDiagnostics('main.ts') || []
        const all = [...syntactic, ...semantic]
        const ignoredCodes = new Set([1128, 2308])
        const filtered = all.filter((d) => !ignoredCodes.has(d.code))

        const code = files['main.ts']?.content || ''
        const lineStarts = [0]
        for (let i = 0; i < code.length; i++) {
          if (code[i] === '\n') lineStarts.push(i + 1)
        }

        result = filtered.map((d) => {
          const start = d.start || 0
          let l = 0
          let r = lineStarts.length - 1
          while (l <= r) {
            const m = (l + r) >> 1
            if (lineStarts[m] <= start) l = m + 1
            else r = m - 1
          }

          const line = r
          const character = start - lineStarts[line]

          let message = 'Unknown error'
          try {
            message = TS.flattenDiagnosticMessageText(d.messageText, '\n')
          } catch {
            message = String(d.messageText)
          }

          return {
            start,
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
        if (!ls) {
          result = undefined
          break
        }

        const info = ls.getQuickInfoAtPosition('main.ts', payload.offset)
        if (!info) {
          result = undefined
          break
        }

        const displayString = TS.displayPartsToString(info.displayParts)
        const docString = info.documentation
          ? TS.displayPartsToString(info.documentation)
          : undefined
        const namePart = info.displayParts?.find((p) =>
          [
            'localName',
            'parameterName',
            'methodName',
            'functionName',
            'className',
            'interfaceName',
            'aliasName',
            'propertyName',
            'enumName',
            'moduleName',
          ].includes(p.kind)
        )
        result = {
          name: namePart ? namePart.text : '',
          kind: info.kind,
          typeAnnotation: displayString,
          jsDoc: docString,
        }
        break
      }

      case 'GET_COMPLETIONS': {
        if (!ls) {
          result = []
          break
        }

        const completions = ls.getCompletionsAtPosition(
          'main.ts',
          payload.offset,
          undefined
        )
        if (!completions) {
          result = []
          break
        }

        result = completions.entries.map((e) => ({
          name: e.name,
          kind: e.kind,
          insertText: e.insertText,
        }))
        break
      }

      case 'COMPILE': {
        if (globalInitPromise) await globalInitPromise
        if (!esbuildReady) throw new Error('esbuild not initialized')

        const jsBuild = await esbuild.build({
          bundle: false, // Do not bundle external dependencies, WebContainer handles them
          format: 'esm',
          target: 'es2020',
          write: false,
          sourcemap: false,
          stdin: {
            contents: payload.code,
            loader: 'ts',
            sourcefile: 'main.ts',
          },
        })

        const js = jsBuild.outputFiles?.[0]?.text || ''
        const dts = generateDeclarations(payload.code)
        result = { js, dts }
        break
      }

      case 'DETECT_IMPORTS': {
        if (globalInitPromise) await globalInitPromise
        const sourceFile = TS.createSourceFile(
          'temp.ts',
          payload.code,
          TS.ScriptTarget.Latest,
          true
        )
        const imports = new Set<string>()

        // Node.js built-in modules that should not be added to package.json
        const builtinModules = new Set([
          'assert',
          'async_hooks',
          'buffer',
          'child_process',
          'cluster',
          'console',
          'constants',
          'crypto',
          'dgram',
          'diagnostics_channel',
          'dns',
          'domain',
          'events',
          'fs',
          'fs/promises',
          'http',
          'http2',
          'https',
          'inspector',
          'module',
          'net',
          'os',
          'path',
          'path/posix',
          'path/win32',
          'perf_hooks',
          'process',
          'punycode',
          'querystring',
          'readline',
          'repl',
          'stream',
          'stream/promises',
          'stream/consumers',
          'stream/web',
          'string_decoder',
          'sys',
          'timers',
          'timers/promises',
          'tls',
          'trace_events',
          'tty',
          'url',
          'util',
          'util/types',
          'v8',
          'vm',
          'wasi',
          'worker_threads',
          'zlib',
        ])

        function visit(node: TS.Node) {
          if (TS.isImportDeclaration(node)) {
            const text = (node.moduleSpecifier as TS.StringLiteral)?.text
            if (
              text &&
              !text.startsWith('.') &&
              !text.startsWith('/') &&
              !text.startsWith('http')
            ) {
              const parts = text.split('/')
              const name = text.startsWith('@')
                ? `${parts[0]}/${parts[1]}`
                : parts[0]
              if (
                name &&
                !builtinModules.has(name) &&
                !name.startsWith('node:')
              ) {
                imports.add(name)
              }
            }
          } else if (
            TS.isCallExpression(node) &&
            node.expression.kind === TS.SyntaxKind.ImportKeyword
          ) {
            const arg = node.arguments[0]
            if (arg && TS.isStringLiteral(arg)) {
              const { text } = arg
              if (
                text &&
                !text.startsWith('.') &&
                !text.startsWith('/') &&
                !text.startsWith('http')
              ) {
                const parts = text.split('/')
                const name = text.startsWith('@')
                  ? `${parts[0]}/${parts[1]}`
                  : parts[0]
                if (
                  name &&
                  !builtinModules.has(name) &&
                  !name.startsWith('node:')
                ) {
                  imports.add(name)
                }
              }
            }
          }

          TS.forEachChild(node, visit)
        }

        visit(sourceFile)
        result = [...imports]
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
