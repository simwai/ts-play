import * as TS from 'typescript'
import * as esbuild from 'esbuild-wasm'
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url'

import { toErrorMessage } from './errors'
import {
  defaultLibraryFiles,
  createConfigHost,
  getScriptFileNames,
  scriptVersionFor,
  snapshotFor,
  readVirtualFile,
  readVirtualDirectory,
  isKnownSourceFile,
} from './virtualFs'

const TS18003_NO_INPUTS = 18003

export interface LanguageServiceState {
  languageService: TS.LanguageService | undefined
  compilerOptions: TS.CompilerOptions
  virtualFiles: Record<string, { content: string; version: number }>
  externalPackageDefinitions: Record<string, string>
  externalPackageVersion: number
  isEsbuildInitialized: boolean
  initPromise: Promise<void> | null
}

export function createInitialState(): LanguageServiceState {
  return {
    languageService: undefined,
    compilerOptions: {
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
    },
    virtualFiles: {},
    externalPackageDefinitions: {},
    externalPackageVersion: 0,
    isEsbuildInitialized: false,
    initPromise: null,
  }
}

export async function ensureInitialized(
  state: LanguageServiceState
): Promise<void> {
  if (state.initPromise) return state.initPromise
  state.initPromise = (async () => {
    if (!state.isEsbuildInitialized) {
      try {
        await esbuild.initialize({ wasmURL: esbuildWasmUrl, worker: false })
        state.isEsbuildInitialized = true
      } catch (err) {
        // Use console.error here as this is initialization, not user-facing
        // The error will be re-thrown and caught by the message handler
        console.error('esbuild initialization failed:', err)
        throw err
      }
    }
    await initializeLanguageService(state)
  })()
  return state.initPromise
}

export async function initializeLanguageService(state: LanguageServiceState) {
  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () =>
      getScriptFileNames(state.externalPackageDefinitions),
    getScriptVersion: (fileName) =>
      scriptVersionFor(
        fileName,
        state.virtualFiles,
        state.externalPackageDefinitions,
        state.externalPackageVersion
      ),
    getScriptSnapshot: (fileName) =>
      snapshotFor(
        fileName,
        state.virtualFiles,
        state.externalPackageDefinitions
      ),
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => state.compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: (path) =>
      isKnownSourceFile(path, state.externalPackageDefinitions),
    readFile: (path) =>
      readVirtualFile(
        path,
        state.virtualFiles,
        state.externalPackageDefinitions
      ),
    readDirectory: (path, extensions) =>
      readVirtualDirectory(path, state.externalPackageDefinitions, extensions),
    directoryExists: (path) => {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const searchPath = normalizedPath.startsWith('/')
        ? normalizedPath.substring(1)
        : normalizedPath
      return Object.keys(state.externalPackageDefinitions).some((f) =>
        f.startsWith(searchPath)
      )
    },
  }
  state.languageService = TS.createLanguageService(host)
}

export function generateAmbientDeclarations(sourceCode: string): string {
  return (
    '// Declarations auto-generated from main.ts\n' +
    sourceCode
      .split('\n')
      .filter((l) => l.startsWith('export'))
      .join('\n')
  )
}
