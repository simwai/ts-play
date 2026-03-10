/// <reference lib="webworker" />
import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import * as TS from 'typescript';

import lib_es5_d_ts from 'typescript/lib/lib.es5.d.ts?raw';
import lib_es2015_d_ts from 'typescript/lib/lib.es2015.d.ts?raw';
import lib_es2015_core_d_ts from 'typescript/lib/lib.es2015.core.d.ts?raw';
import lib_es2015_collection_d_ts from 'typescript/lib/lib.es2015.collection.d.ts?raw';
import lib_es2015_generator_d_ts from 'typescript/lib/lib.es2015.generator.d.ts?raw';
import lib_es2015_iterable_d_ts from 'typescript/lib/lib.es2015.iterable.d.ts?raw';
import lib_es2015_promise_d_ts from 'typescript/lib/lib.es2015.promise.d.ts?raw';
import lib_es2015_proxy_d_ts from 'typescript/lib/lib.es2015.proxy.d.ts?raw';
import lib_es2015_reflect_d_ts from 'typescript/lib/lib.es2015.reflect.d.ts?raw';
import lib_es2015_symbol_d_ts from 'typescript/lib/lib.es2015.symbol.d.ts?raw';
import lib_es2015_symbol_wellknown_d_ts from 'typescript/lib/lib.es2015.symbol.wellknown.d.ts?raw';
import lib_es2016_d_ts from 'typescript/lib/lib.es2016.d.ts?raw';
import lib_es2016_array_include_d_ts from 'typescript/lib/lib.es2016.array.include.d.ts?raw';
import lib_es2017_d_ts from 'typescript/lib/lib.es2017.d.ts?raw';
import lib_es2017_date_d_ts from 'typescript/lib/lib.es2017.date.d.ts?raw';
import lib_es2017_object_d_ts from 'typescript/lib/lib.es2017.object.d.ts?raw';
import lib_es2017_sharedmemory_d_ts from 'typescript/lib/lib.es2017.sharedmemory.d.ts?raw';
import lib_es2017_string_d_ts from 'typescript/lib/lib.es2017.string.d.ts?raw';
import lib_es2017_intl_d_ts from 'typescript/lib/lib.es2017.intl.d.ts?raw';
import lib_es2017_typedarrays_d_ts from 'typescript/lib/lib.es2017.typedarrays.d.ts?raw';
import lib_es2018_d_ts from 'typescript/lib/lib.es2018.d.ts?raw';
import lib_es2018_asyncgenerator_d_ts from 'typescript/lib/lib.es2018.asyncgenerator.d.ts?raw';
import lib_es2018_asynciterable_d_ts from 'typescript/lib/lib.es2018.asynciterable.d.ts?raw';
import lib_es2018_intl_d_ts from 'typescript/lib/lib.es2018.intl.d.ts?raw';
import lib_es2018_promise_d_ts from 'typescript/lib/lib.es2018.promise.d.ts?raw';
import lib_es2018_regexp_d_ts from 'typescript/lib/lib.es2018.regexp.d.ts?raw';
import lib_es2019_d_ts from 'typescript/lib/lib.es2019.d.ts?raw';
import lib_es2019_array_d_ts from 'typescript/lib/lib.es2019.array.d.ts?raw';
import lib_es2019_object_d_ts from 'typescript/lib/lib.es2019.object.d.ts?raw';
import lib_es2019_string_d_ts from 'typescript/lib/lib.es2019.string.d.ts?raw';
import lib_es2019_symbol_d_ts from 'typescript/lib/lib.es2019.symbol.d.ts?raw';
import lib_es2019_intl_d_ts from 'typescript/lib/lib.es2019.intl.d.ts?raw';
import lib_es2020_d_ts from 'typescript/lib/lib.es2020.d.ts?raw';
import lib_es2020_bigint_d_ts from 'typescript/lib/lib.es2020.bigint.d.ts?raw';
import lib_es2020_date_d_ts from 'typescript/lib/lib.es2020.date.d.ts?raw';
import lib_es2020_promise_d_ts from 'typescript/lib/lib.es2020.promise.d.ts?raw';
import lib_es2020_sharedmemory_d_ts from 'typescript/lib/lib.es2020.sharedmemory.d.ts?raw';
import lib_es2020_string_d_ts from 'typescript/lib/lib.es2020.string.d.ts?raw';
import lib_es2020_symbol_wellknown_d_ts from 'typescript/lib/lib.es2020.symbol.wellknown.d.ts?raw';
import lib_es2020_intl_d_ts from 'typescript/lib/lib.es2020.intl.d.ts?raw';
import lib_es2020_number_d_ts from 'typescript/lib/lib.es2020.number.d.ts?raw';
import lib_dom_d_ts from 'typescript/lib/lib.dom.d.ts?raw';
import lib_dom_iterable_d_ts from 'typescript/lib/lib.dom.iterable.d.ts?raw';

let ls: TS.LanguageService | null = null;
let esbuildReady = false;
let globalInitPromise: Promise<void> | null = null;

const files: Record<string, { version: number; content: string }> = {};
const libFiles: Record<string, { version: number; content: string }> = {};
let extraLibs: Record<string, string> = {};

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
};

function ensureRequiredLibsLoaded() {
  for (const [fileName, content] of Object.entries(rawLibs)) {
    if (content) libFiles[fileName] = { version: 1, content };
  }
}

async function initLanguageService() {
  if (ls) return;
  const compilerOptions: TS.CompilerOptions = {
    target: TS.ScriptTarget.ES2020,
    module: TS.ModuleKind.ESNext,
    moduleResolution: TS.ModuleResolutionKind.NodeJs,
    lib: Object.keys(rawLibs),
    esModuleInterop: true,
    strict: true,
    skipLibCheck: true,
    suppressExcessPropertyErrors: true,
    noImplicitAny: false,
    typeRoots: [],
  };

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => ['/main.ts', ...Object.keys(libFiles).map(n => `/${n}`), ...Object.keys(extraLibs)],
    getScriptVersion: (fileName) => {
      const normalized = fileName.replace(/^\/+/, '');
      if (normalized === 'main.ts') return String(files['main.ts']?.version ?? 0);
      if (libFiles[normalized]) return String(libFiles[normalized].version);
      if (extraLibs[fileName]) return String(extraLibs[fileName].length);
      if (extraLibs[normalized]) return String(extraLibs[normalized].length);
      return '0';
    },
    getScriptSnapshot: (fileName) => {
      const normalized = fileName.replace(/^\/+/, '');
      let content: string | undefined;
      if (normalized === 'main.ts') content = files['main.ts']?.content;
      else if (libFiles[normalized]) content = libFiles[normalized].content;
      else if (extraLibs[fileName]) content = extraLibs[fileName];
      else if (extraLibs[normalized]) content = extraLibs[normalized];

      if (content !== undefined) return TS.ScriptSnapshot.fromString(content);
      return undefined;
    },
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => '/lib.es2020.d.ts',
    fileExists: (fileName) => {
      const normalized = fileName.replace(/^\/+/, '');
      return normalized === 'main.ts' || !!libFiles[normalized] || !!extraLibs[fileName] || !!extraLibs[normalized];
    },
    readFile: (fileName) => {
      const normalized = fileName.replace(/^\/+/, '');
      if (normalized === 'main.ts') return files['main.ts']?.content;
      if (libFiles[normalized]) return libFiles[normalized].content;
      if (extraLibs[fileName]) return extraLibs[fileName];
      if (extraLibs[normalized]) return extraLibs[normalized];
      return undefined;
    },
    readDirectory: () => [],
    directoryExists: () => true,
    getDirectories: () => [],
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (fileName) => fileName,
    getNewLine: () => "\n"
  };

  ls = TS.createLanguageService(host, TS.createDocumentRegistry());
}

function extractClassDeclaration(lines: string[]): string[] {
  const result: string[] = [];
  const firstLine = lines[0].trim();
  const isExport = firstLine.startsWith('export');
  const prefix = isExport ? 'export declare' : 'declare';
  const cleaned = firstLine
    .replace(/^export\s+/, '')
    .replace(/^(abstract\s+)?class/, `${prefix} $1class`.replace(/\s+/g, ' '));
  result.push(cleaned.includes('{') ? cleaned : cleaned + ' {');

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line || line === '{' || line === '}') continue;

    const propMatch = line.match(/^(public|private|protected|readonly|static|\s)*(\w+)\s*[?!]?\s*:\s*([^;=]+)/);
    if (propMatch) {
      result.push(`  ${propMatch[2]}: ${propMatch[3].trim()};`);
      continue;
    }

    const methMatch = line.match(/^(public|private|protected|static|async|\s)*(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?/);
    if (methMatch) {
      const [, , name, gen, params, ret] = methMatch;
      const isAsync = /\basync\s+/.test(line);
      if (name === 'constructor') {
        result.push(`  constructor(${params});`);
      } else {
        const finalRet = ret?.trim() || (isAsync ? 'Promise<void>' : 'void');
        result.push(`  ${name}${gen || ''}(${params}): ${finalRet};`);
      }
      if (line.includes('{')) {
        let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (depth > 0 && i + 1 < lines.length - 1) {
          i++;
          depth += (lines[i].match(/\{/g) || []).length;
          depth -= (lines[i].match(/\}/g) || []).length;
        }
      }
    }
  }

  result.push('}');
  return result;
}

function generateDeclarations(code: string): string {
  const lines = code.split('\n');
  const dtsLines: string[] = [];
  let inBlockComment = false;
  let pendingJsDoc: string[] = [];
  let braceDepth = 0;
  let capturing = false;
  let captureLines: string[] = [];
  let captureType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inBlockComment) {
      if (capturing) captureLines.push(line);
      else pendingJsDoc.push(line);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      if (capturing) captureLines.push(line);
      else pendingJsDoc = [line];
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    if (capturing) {
      captureLines.push(line);
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth <= 0) {
        if (captureType === 'class') {
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(...extractClassDeclaration(captureLines));
        } else {
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(...captureLines);
        }
        dtsLines.push('');
        capturing = false;
        captureLines = [];
        pendingJsDoc = [];
        captureType = '';
      }
      continue;
    }

    if (trimmed.startsWith('//')) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) continue;

    if (/^(export\s+)?interface\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'interface';
      captureLines = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && line.includes('}')) {
        dtsLines.push(...pendingJsDoc, line, '');
        capturing = false;
        captureLines = [];
        pendingJsDoc = [];
      }
      continue;
    }

    if (/^(export\s+)?type\s+\w+/.test(trimmed)) {
      dtsLines.push(...pendingJsDoc);
      if (!trimmed.includes(';') && trimmed.includes('{')) {
        capturing = true;
        captureType = 'type';
        captureLines = [line];
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      } else {
        dtsLines.push(trimmed.startsWith('export') ? line : `export ${line}`);
        dtsLines.push('');
      }
      pendingJsDoc = [];
      continue;
    }

    if (/^(export\s+)?(const\s+)?enum\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'enum';
      const declLine = trimmed.startsWith('export') ? line : `export ${line}`;
      captureLines = [declLine.replace(/^(export\s+)?(const\s+)?enum/, 'declare enum')];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    if (/^(export\s+)?(abstract\s+)?class\s+/.test(trimmed)) {
      capturing = true;
      captureType = 'class';
      captureLines = [line];
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      continue;
    }

    const fnMatch = trimmed.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?/);
    if (fnMatch) {
      const [, exp, isAsync, name, generics, params, returnType] = fnMatch;
      const gen = generics || '';
      const ret = returnType?.trim() || (isAsync ? 'Promise<void>' : 'void');
      const prefix = exp ? 'export declare' : 'declare';
      dtsLines.push(...pendingJsDoc);
      dtsLines.push(`${prefix} function ${name}${gen}(${params}): ${ret};`);
      dtsLines.push('');
      pendingJsDoc = [];
      if (trimmed.includes('{')) {
        let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          depth += (lines[i].match(/\{/g) || []).length;
          depth -= (lines[i].match(/\}/g) || []).length;
        }
      }
      continue;
    }

    const constMatch = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*(?::\s*([^=]+?))?\s*=/);
    if (constMatch) {
      const [, exp, _kind, name, explicitType] = constMatch;
      const prefix = exp ? 'export declare' : 'declare';

      if (explicitType) {
        dtsLines.push(...pendingJsDoc);
        dtsLines.push(`${prefix} const ${name}: ${explicitType.trim()};`);
        dtsLines.push('');
      } else {
        const valueMatch = trimmed.match(/=\s*(.+?)(?:;|$)/);
        if (valueMatch) {
          const val = valueMatch[1].trim();
          let inferredType = 'unknown';
          if (/^["'`]/.test(val)) inferredType = 'string';
          else if (/^\d/.test(val)) inferredType = 'number';
          else if (val === 'true' || val === 'false') inferredType = 'boolean';
          else if (val.startsWith('[')) inferredType = 'unknown[]';
          else if (val.startsWith('{')) inferredType = 'Record<string, unknown>';
          else if (val.startsWith('new ')) {
            const className = val.match(/new\s+(\w+)/)?.[1];
            inferredType = className || 'unknown';
          }
          if (val.includes('=>') || val.startsWith('function') || val.startsWith('async')) {
            const arrowMatch = val.match(/(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+?))?\s*=>/);
            if (arrowMatch) {
              const aParams = arrowMatch[1];
              const aRet = arrowMatch[2]?.trim() || 'void';
              const isAsync = val.startsWith('async');
              const retType = isAsync && !aRet.startsWith('Promise') ? `Promise<${aRet}>` : aRet;
              dtsLines.push(...pendingJsDoc);
              dtsLines.push(`${prefix} const ${name}: (${aParams}) => ${retType};`);
              dtsLines.push('');
              pendingJsDoc = [];
              if (trimmed.includes('{')) {
                let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                while (depth > 0 && i + 1 < lines.length) {
                  i++;
                  depth += (lines[i].match(/\{/g) || []).length;
                  depth -= (lines[i].match(/\}/g) || []).length;
                }
              }
              continue;
            }
          }
          dtsLines.push(...pendingJsDoc);
          dtsLines.push(`${prefix} const ${name}: ${inferredType};`);
          dtsLines.push('');
        }
      }
      pendingJsDoc = [];
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          depth += (lines[i].match(/\{/g) || []).length;
          depth -= (lines[i].match(/\}/g) || []).length;
        }
      }
      continue;
    }

    pendingJsDoc = [];
  }

  return dtsLines.join('\n').trim() || '// No exported declarations found';
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;
  try {
    let result: any;

    switch (type) {
      case 'INIT': {
        if (!globalInitPromise) {
          globalInitPromise = (async () => {
            ensureRequiredLibsLoaded();
            if (!esbuildReady) {
              await esbuild.initialize({
                wasmURL: esbuildWasmUrl,
                worker: false,
              });
              esbuildReady = true;
            }
            await initLanguageService();
          })();
        }
        await globalInitPromise;
        result = true;
        break;
      }

      case 'UPDATE_FILE': {
        const { filename, content } = payload;
        const normalized = filename.replace(/^\/+/, '');
        if (files[normalized]?.content !== content) {
          files[normalized] = {
            version: (files[normalized]?.version || 0) + 1,
            content
          };
        }
        result = true;
        break;
      }

      case 'UPDATE_EXTRA_LIBS': {
        extraLibs = payload.libs;
        result = true;
        break;
      }

      case 'GET_DIAGNOSTICS': {
        if (!ls) {
          result = [];
          break;
        }
        const syntactic = ls.getSyntacticDiagnostics('main.ts') || [];
        const semantic = ls.getSemanticDiagnostics('main.ts') || [];
        const all = [...syntactic, ...semantic];
        const ignoredCodes = new Set([1128, 2308]);
        const filtered = all.filter(d => !ignoredCodes.has(d.code));

        const code = files['main.ts']?.content || '';
        const lineStarts = [0];
        for (let i = 0; i < code.length; i++) {
          if (code[i] === '\n') lineStarts.push(i + 1);
        }

        result = filtered.map(d => {
          const start = d.start || 0;
          let l = 0, r = lineStarts.length - 1;
          while (l <= r) {
            const m = (l + r) >> 1;
            if (lineStarts[m] <= start) l = m + 1;
            else r = m - 1;
          }
          const line = r;
          const character = start - lineStarts[line];
          
          let message = 'Unknown error';
          try {
            message = TS.flattenDiagnosticMessageText(d.messageText, "\n");
          } catch (err) {
            message = String(d.messageText);
          }
          
          return {
            start,
            length: d.length || 0,
            message,
            category: d.category === TS.DiagnosticCategory.Warning ? 'warning' : 'error',
            line,
            character,
          };
        });
        break;
      }

      case 'GET_TYPE_INFO': {
        if (!ls) {
          result = null;
          break;
        }
        const info = ls.getQuickInfoAtPosition('main.ts', payload.offset);
        if (!info) {
          result = null;
          break;
        }
        const displayString = TS.displayPartsToString(info.displayParts);
        const docString = info.documentation ? TS.displayPartsToString(info.documentation) : undefined;
        const namePart = info.displayParts?.find(p => 
          ['localName', 'parameterName', 'methodName', 'functionName', 'className', 'interfaceName', 'aliasName', 'propertyName', 'enumName', 'moduleName'].includes(p.kind)
        );
        result = {
          name: namePart ? namePart.text : '',
          kind: info.kind,
          typeAnnotation: displayString,
          jsDoc: docString,
        };
        break;
      }

      case 'COMPILE': {
        if (globalInitPromise) await globalInitPromise;
        if (!esbuildReady) throw new Error('esbuild not initialized');

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
        });

        const js = jsBuild.outputFiles?.[0]?.text || '';
        const dts = generateDeclarations(payload.code);
        result = { js, dts };
        break;
      }

      case 'DETECT_IMPORTS': {
        if (globalInitPromise) await globalInitPromise;
        const sourceFile = TS.createSourceFile('temp.ts', payload.code, TS.ScriptTarget.Latest, true);
        const imports = new Set<string>();
        function visit(node: TS.Node) {
          if (TS.isImportDeclaration(node)) {
            const text = (node.moduleSpecifier as TS.StringLiteral)?.text;
            if (text && !text.startsWith('.') && !text.startsWith('/') && !text.startsWith('http')) {
              const parts = text.split('/');
              const name = text.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
              if (name) imports.add(name);
            }
          } else if (TS.isCallExpression(node) && node.expression.kind === TS.SyntaxKind.ImportKeyword) {
            const arg = node.arguments[0];
            if (arg && TS.isStringLiteral(arg)) {
              const text = arg.text;
              if (text && !text.startsWith('.') && !text.startsWith('/') && !text.startsWith('http')) {
                const parts = text.split('/');
                const name = text.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
                if (name) imports.add(name);
              }
            }
          }
          TS.forEachChild(node, visit);
        }
        visit(sourceFile);
        result = Array.from(imports);
        break;
      }

      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }

    self.postMessage({ id, success: true, payload: result });
  } catch (err) {
    self.postMessage({ id, success: false, error: (err as Error).message });
  }
};
