import { useCallback } from 'react';

export interface TypeInfo {
  name:           string;
  kind:           'variable' | 'function' | 'type' | 'interface' | 'class'
                | 'parameter' | 'property' | 'keyword' | 'builtin';
  typeAnnotation: string;
  signature?:     string;
  jsDoc?:         string;
  detail?:        string;
}

// ── Static dictionaries (created once, not per call) ─────────────────────────

const KEYWORDS: Record<string, string> = {
  const:       'Declares a block-scoped constant. Cannot be reassigned.',
  let:         'Declares a block-scoped variable that can be reassigned.',
  var:         'Declares a function-scoped or globally-scoped variable.',
  function:    'Declares a function.',
  class:       'Declares a class.',
  interface:   'Declares an interface (TypeScript).',
  type:        'Declares a type alias (TypeScript).',
  return:      'Returns a value from a function.',
  import:      'Imports bindings exported from another module.',
  export:      'Exports a binding from the current module.',
  async:       'Marks a function as asynchronous; it returns a Promise.',
  await:       'Pauses async function execution until a Promise resolves.',
  new:         'Creates an instance of a constructor.',
  instanceof:  'Tests whether an object has a constructor in its prototype chain.',
  void:        'Evaluates an expression and returns undefined.',
  delete:      'Deletes a property from an object.',
  throw:       'Throws a user-defined exception.',
  try:         'Marks a block to test for errors.',
  catch:       'Catches exceptions thrown in a try block.',
  finally:     'Executes code after try/catch, regardless of result.',
  if:          'Executes a block if the condition is truthy.',
  else:        'Executes a block when the preceding if is falsy.',
  for:         'Creates a loop.',
  while:       'Creates a loop that executes while the condition is truthy.',
  switch:      'Evaluates an expression against multiple cases.',
  break:       'Terminates a loop or switch statement.',
  continue:    'Skips to the next loop iteration.',
  null:        'Represents the intentional absence of any object value.',
  undefined:   'Indicates a variable has not been assigned a value.',
  true:        'Boolean true literal.',
  false:       'Boolean false literal.',
  this:        'Refers to the current execution context object.',
  super:       'Refers to the parent class constructor or methods.',
  extends:     'Creates a class that is a child of another class.',
  implements:  'Declares that a class satisfies an interface (TypeScript).',
  readonly:    'Makes a property immutable after initialization (TypeScript).',
  private:     'Restricts access to the class body (TypeScript).',
  public:      'Allows access from anywhere (TypeScript).',
  protected:   'Restricts access to the class and subclasses (TypeScript).',
  static:      'Defines a method or property on the class itself.',
  abstract:    'Declares a class or method that must be subclassed/overridden.',
  enum:        'Declares a set of named constants (TypeScript).',
  namespace:   'Declares a module namespace (TypeScript).',
  declare:     'Tells TypeScript about a type without emitting code.',
  as:          'Type assertion operator (TypeScript).',
  keyof:       'Produces a union of all keys of a type (TypeScript).',
  typeof:      'Returns a string describing the type of an operand.',
  infer:       'Infers a type variable within conditional types (TypeScript).',
  never:       'Represents values that never occur (TypeScript).',
  unknown:     'A type-safe counterpart of any (TypeScript).',
  any:         'Opts out of type-checking for a value (TypeScript).',
  in:          'Checks if a property exists in an object / for-in loop.',
  of:          'Used in for-of loops to iterate over iterables.',
  from:        'Specifies the source module in an import statement.',
  default:     'Specifies the default export of a module.',
  satisfies:   'Asserts that a value satisfies a type without widening (TypeScript 4.9+).',
};

const BUILTINS: Record<string, { type: string; detail: string }> = {
  console:      { type: 'Console',                                         detail: 'Provides access to the browser debugging console.' },
  log:          { type: '(...data: any[]) => void',                        detail: 'Outputs a message to the console.' },
  error:        { type: '(...data: any[]) => void',                        detail: 'Outputs an error message to the console.' },
  warn:         { type: '(...data: any[]) => void',                        detail: 'Outputs a warning message to the console.' },
  info:         { type: '(...data: any[]) => void',                        detail: 'Outputs an informational message.' },
  JSON:         { type: 'JSON',                                            detail: 'Provides JSON serialization and parsing utilities.' },
  Math:         { type: 'Math',                                            detail: 'Provides mathematical constants and functions.' },
  Date:         { type: 'DateConstructor',                                 detail: 'Creates and manages date/time values.' },
  Array:        { type: 'ArrayConstructor',                                detail: 'Creates and manages ordered collections.' },
  Object:       { type: 'ObjectConstructor',                               detail: 'Provides methods for creating and managing objects.' },
  String:       { type: 'StringConstructor',                               detail: 'Wraps string primitives with methods.' },
  Number:       { type: 'NumberConstructor',                               detail: 'Wraps numeric primitives with methods.' },
  Boolean:      { type: 'BooleanConstructor',                              detail: 'Wraps boolean primitives.' },
  Promise:      { type: 'PromiseConstructor',                              detail: 'Represents an eventual value from an async operation.' },
  Map:          { type: 'MapConstructor',                                  detail: 'A key/value collection that remembers insertion order.' },
  Set:          { type: 'SetConstructor',                                  detail: 'A collection of unique values.' },
  WeakMap:      { type: 'WeakMapConstructor',                              detail: 'Holds weak references to objects as keys.' },
  WeakSet:      { type: 'WeakSetConstructor',                              detail: 'Holds weak references to objects.' },
  RegExp:       { type: 'RegExpConstructor',                               detail: 'Creates regular expression objects.' },
  Error:        { type: 'ErrorConstructor',                                detail: 'Creates error objects.' },
  Symbol:       { type: 'SymbolConstructor',                               detail: 'Creates unique, immutable primitive values.' },
  parseInt:     { type: '(string: string, radix?: number) => number',      detail: 'Parses a string and returns an integer.' },
  parseFloat:   { type: '(string: string) => number',                      detail: 'Parses a string and returns a floating-point number.' },
  isNaN:        { type: '(value: number) => boolean',                      detail: 'Determines whether a value is NaN.' },
  isFinite:     { type: '(value: number) => boolean',                      detail: 'Determines whether a value is finite.' },
  encodeURI:    { type: '(uri: string) => string',                         detail: 'Encodes a URI.' },
  decodeURI:    { type: '(encodedURI: string) => string',                  detail: 'Decodes a URI.' },
  setTimeout:   { type: '(handler: TimerHandler, timeout?: number) => number', detail: 'Executes a function after a delay.' },
  clearTimeout: { type: '(id?: number) => void',                           detail: 'Cancels a timeout set with setTimeout.' },
  setInterval:  { type: '(handler: TimerHandler, timeout?: number) => number', detail: 'Repeatedly executes a function at a fixed interval.' },
  clearInterval:{ type: '(id?: number) => void',                           detail: 'Cancels a setInterval timer.' },
  fetch:        { type: '(input: RequestInfo, init?: RequestInit) => Promise<Response>', detail: 'Makes HTTP requests.' },
  document:     { type: 'Document',                                        detail: 'Represents the HTML document in the browser.' },
  window:       { type: 'Window & typeof globalThis',                      detail: 'Represents the browser window.' },
  globalThis:   { type: 'typeof globalThis',                               detail: 'Universal way to access the global object.' },
  structuredClone: { type: '<T>(value: T) => T',                           detail: 'Creates a deep clone of a value.' },
  queueMicrotask:  { type: '(callback: VoidFunction) => void',             detail: 'Queues a microtask to be executed before the next task.' },
};

// ── Pure helpers (no closures over mutable state) ─────────────────────────────

function extractJsDoc(code: string, identStart: number): string | undefined {
  const before = code.slice(0, identStart).trimEnd();
  const m = before.match(/\/\*\*([\s\S]*?)\*\/\s*$/);
  if (!m) return undefined;
  return m[1]
    .split('\n')
    .map(l => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim() || undefined;
}

function wordAt(code: string, offset: number): { word: string; start: number; end: number } | null {
  if (offset < 0 || offset > code.length) return null;
  // If we're sitting right after a word char, step back one
  const adjusted = offset > 0 && !/[\w$]/.test(code[offset] ?? '') ? offset - 1 : offset;
  if (!/[\w$]/.test(code[adjusted] ?? '')) return null;
  let start = adjusted;
  let end   = adjusted;
  while (start > 0 && /[\w$]/.test(code[start - 1])) start--;
  while (end < code.length && /[\w$]/.test(code[end])) end++;
  const word = code.slice(start, end);
  return word ? { word, start, end } : null;
}

function inferType(val: string): string {
  const v = val.trim();
  if (/^['"`]/.test(v))                              return 'string';
  if (v === 'true' || v === 'false')                 return 'boolean';
  if (v === 'null')                                  return 'null';
  if (v === 'undefined')                             return 'undefined';
  if (/^-?\d+\.\d+$/.test(v))                       return 'number';
  if (/^-?\d+n$/.test(v))                           return 'bigint';
  if (/^-?\d+$/.test(v))                            return 'number';
  if (v.startsWith('['))                             return 'Array';
  if (v.startsWith('{'))                             return 'object';
  if (v.startsWith('/') && v.endsWith('/'))          return 'RegExp';
  if (/^new\s+([\w$]+)/.test(v))                    return v.match(/^new\s+([\w$]+)/)![1];
  if (v.startsWith('async ') || v.includes('=>'))   return 'Function';
  if (v.startsWith('function'))                     return 'Function';
  return 'unknown';
}

// ── Main analysis function ────────────────────────────────────────────────────

function analyse(code: string, offset: number): TypeInfo | null {
  const hit = wordAt(code, offset);
  if (!hit) return null;
  const { word, start } = hit;
  if (word.length < 1) return null;

  // 1. Keywords
  if (KEYWORDS[word]) {
    return { name: word, kind: 'keyword', typeAnnotation: 'keyword', detail: KEYWORDS[word] };
  }

  // 2. Built-ins
  if (BUILTINS[word]) {
    const b = BUILTINS[word];
    return { name: word, kind: 'builtin', typeAnnotation: b.type, detail: b.detail };
  }

  const jsDoc = extractJsDoc(code, start);

  // 3. Interface declaration
  // interface Foo<T> extends Bar { … }
  const ifaceRe = new RegExp(
    `interface\\s+${word}\\s*(?:<[^{]*>)?\\s*(?:extends[^{]*)?\\{([^}]*)\\}`, 's'
  );
  const ifaceM = code.match(ifaceRe);
  if (ifaceM) {
    const body = ifaceM[1].trim().replace(/\s+/g, ' ');
    return { name: word, kind: 'interface', typeAnnotation: `interface ${word} { ${body} }`, jsDoc };
  }

  // 4. Type alias — type Foo<T> = ...
  const typeRe = new RegExp(`type\\s+${word}\\s*(?:<[^=]*>)?\\s*=\\s*([^;\\n]+)`, 's');
  const typeM  = code.match(typeRe);
  if (typeM) {
    return { name: word, kind: 'type', typeAnnotation: typeM[1].trim(), jsDoc };
  }

  // 5. Class declaration
  const classRe = new RegExp(`class\\s+${word}(?:\\s+extends\\s+([\\w<>, ]+))?`);
  const classM  = code.match(classRe);
  if (classM) {
    const ext = classM[1] ? ` extends ${classM[1].trim()}` : '';
    return { name: word, kind: 'class', typeAnnotation: `class ${word}${ext}`, jsDoc };
  }

  // 6. Function declaration (incl. async, generics)
  const fnDeclRe = new RegExp(
    `(?:async\\s+)?function\\s*\\*?\\s*${word}\\s*(?:<[^(]*>)?\\s*\\(([^)]*)\\)\\s*(?::\\s*([^{;=\\n]+))?`,
    's'
  );
  const fnM = code.match(fnDeclRe);
  if (fnM) {
    const params = (fnM[1] ?? '').trim().replace(/\s+/g, ' ');
    const ret    = (fnM[2] ?? 'void').trim();
    return {
      name:           word,
      kind:           'function',
      typeAnnotation: ret,
      signature:      `function ${word}(${params}): ${ret}`,
      jsDoc,
    };
  }

  // 7. Arrow / const fn — const foo = (…): T =>
  const arrowRe = new RegExp(
    `(?:const|let|var)\\s+${word}\\s*(?::\\s*([^=]+))?\\s*=\\s*(?:async\\s+)?(?:<[^>]*>\\s*)?\\(([^)]*)\\)\\s*(?::\\s*([^=>\\n{]+))?\\s*=>`,
    's'
  );
  const arrM = code.match(arrowRe);
  if (arrM) {
    const explicit = arrM[1]?.trim();
    const params   = (arrM[2] ?? '').trim();
    const ret      = (arrM[3] ?? '').trim();
    if (explicit) {
      return { name: word, kind: 'function', typeAnnotation: explicit, signature: `${word}: ${explicit}`, jsDoc };
    }
    const retStr = ret || 'unknown';
    return {
      name:           word,
      kind:           'function',
      typeAnnotation: `(${params}) => ${retStr}`,
      signature:      `const ${word} = (${params}): ${retStr} => …`,
      jsDoc,
    };
  }

  // 8. const/let/var with explicit type annotation
  const varTypedRe = new RegExp(`(?:const|let|var)\\s+${word}\\s*:\\s*([^=;,\\n]+)`);
  const varTypedM  = code.match(varTypedRe);
  if (varTypedM) {
    return { name: word, kind: 'variable', typeAnnotation: varTypedM[1].trim(), jsDoc };
  }

  // 9. const/let/var with inferred type
  const varRe = new RegExp(`(?:const|let|var)\\s+${word}\\s*=\\s*([^;\\n,]+)`);
  const varM  = code.match(varRe);
  if (varM) {
    const raw = varM[1].trim();
    return {
      name:           word,
      kind:           'variable',
      typeAnnotation: inferType(raw),
      detail:         `= ${raw.length > 48 ? raw.slice(0, 48) + '…' : raw}`,
      jsDoc,
    };
  }

  // 10. Function parameter — looks for word with optional type inside parens
  const paramRe = new RegExp(
    `\\((?:[^)]*[,\\s(])?${word}\\s*(?::\\s*([^,)\\n]+))?(?:[,)])`
  );
  const paramM = code.match(paramRe);
  if (paramM) {
    return { name: word, kind: 'parameter', typeAnnotation: (paramM[1] ?? 'any').trim(), jsDoc };
  }

  // 11. Object property — key: Type (in interface body or object literal)
  const propRe = new RegExp(`\\b${word}\\s*\\??\\s*:\\s*([^,;\\n}]+)`);
  const propM  = code.match(propRe);
  if (propM) {
    return { name: word, kind: 'property', typeAnnotation: propM[1].trim(), jsDoc };
  }

  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTypeInfo() {
  // Stable reference — analyse() is pure and has no deps
  const getTypeInfo = useCallback(
    (code: string, offset: number): TypeInfo | null => analyse(code, offset),
    []
  );
  return { getTypeInfo };
}
