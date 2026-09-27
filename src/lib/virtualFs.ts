import * as TS from 'typescript'

import lib_es5 from 'typescript/lib/lib.es5.d.ts?raw'
import lib_es2020 from 'typescript/lib/lib.es2020.d.ts?raw'
import lib_dom from 'typescript/lib/lib.dom.d.ts?raw'

export const defaultLibraryFiles: Record<string, string> = {
  'lib.es5.d.ts': lib_es5,
  'lib.es2020.d.ts': lib_es2020,
  'lib.dom.d.ts': lib_dom,
}

export function normalizePath(path: string): string {
  const cleaned = path.replace(/^file:\/\/\//, '/')
  return cleaned.startsWith('/') ? cleaned : '/' + cleaned
}

export function isKnownSourceFile(
  path: string,
  externalPackageDefinitions: Record<string, string>
): boolean {
  const normalized = normalizePath(path)
  return !!(
    externalPackageDefinitions[normalized] ||
    externalPackageDefinitions[normalized.substring(1)] ||
    defaultLibraryFiles[normalized.substring(1)] ||
    normalized === '/main.ts'
  )
}

export function readVirtualFile(
  path: string,
  virtualFiles: Record<string, { content: string; version: number }>,
  externalPackageDefinitions: Record<string, string>
): string | undefined {
  const normalized = normalizePath(path)
  if (normalized === '/main.d.ts') return undefined
  return (
    externalPackageDefinitions[normalized] ||
    externalPackageDefinitions[normalized.substring(1)] ||
    defaultLibraryFiles[normalized.substring(1)] ||
    (normalized === '/main.ts' ? virtualFiles['/main.ts']?.content : undefined)
  )
}

export function readVirtualDirectory(
  path: string,
  externalPackageDefinitions: Record<string, string>,
  extensions?: readonly string[]
): string[] {
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
}

export function getScriptFileNames(
  externalPackageDefinitions: Record<string, string>
): string[] {
  const libFiles = Object.keys(defaultLibraryFiles).map((f) => '/' + f)
  const externalFiles = Object.keys(externalPackageDefinitions).map(
    normalizePath
  )
  const filtered = externalFiles.filter(
    (f) => f !== '/main.ts' && f !== '/main.d.ts'
  )
  return ['/main.ts', ...libFiles, ...filtered]
}

export function scriptVersionFor(
  fileName: string,
  virtualFiles: Record<string, { content: string; version: number }>,
  externalPackageDefinitions: Record<string, string>,
  externalPackageVersion: number
): string {
  const normalized = normalizePath(fileName)
  if (normalized === '/main.ts')
    return String(virtualFiles['/main.ts']?.version ?? 0)
  if (
    externalPackageDefinitions[normalized] ||
    externalPackageDefinitions[normalized.substring(1)]
  )
    return String(externalPackageVersion)
  return '0'
}

export function snapshotFor(
  fileName: string,
  virtualFiles: Record<string, { content: string; version: number }>,
  externalPackageDefinitions: Record<string, string>
): TS.IScriptSnapshot | undefined {
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
}

export function createConfigHost(
  externalPackageDefinitions: Record<string, string>
): TS.ParseConfigHost {
  return {
    useCaseSensitiveFileNames: true,
    readDirectory: (path, extensions) =>
      readVirtualDirectory(path, externalPackageDefinitions, extensions),
    fileExists: (path) =>
      isKnownSourceFile(path, externalPackageDefinitions) ||
      normalizePath(path) === '/tsconfig.json',
    readFile: (path) => readVirtualFile(path, {}, externalPackageDefinitions),
  }
}
