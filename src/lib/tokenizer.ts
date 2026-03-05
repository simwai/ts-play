export type TokenType =
  | 'keyword' | 'string' | 'number' | 'comment'
  | 'function' | 'type' | 'operator' | 'punctuation'
  | 'decorator' | 'variable' | 'constant' | 'boolean'
  | 'property' | 'parameter' | 'plain';

export interface Token {
  type: TokenType;
  value: string;
  index: number; // char index in original string
}

const KEYWORDS = new Set([
  'abstract','as','async','await','break','case','catch','class','const',
  'continue','debugger','declare','default','delete','do','else','enum',
  'export','extends','finally','for','from','function','get','if','implements',
  'import','in','infer','instanceof','interface','is','keyof','let','module',
  'namespace','never','new','null','of','override','private','protected',
  'public','readonly','return','satisfies','set','static','super','switch',
  'this','throw','try','type','typeof','undefined','unique','unknown',
  'var','void','while','with','yield',
]);

const TYPES = new Set([
  'string','number','boolean','object','symbol','bigint','any','unknown',
  'never','void','null','undefined','Array','Promise','Record','Partial',
  'Required','Readonly','Pick','Omit','Exclude','Extract','NonNullable',
  'ReturnType','InstanceType','Parameters','ConstructorParameters',
  'Map','Set','WeakMap','WeakSet','Date','RegExp','Error',
]);

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < len && code[i] !== '\n') i++;
      tokens.push({ type: 'comment', value: code.slice(start, i), index: start });
      continue;
    }
    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      const start = i;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      tokens.push({ type: 'comment', value: code.slice(start, i), index: start });
      continue;
    }
    // Decorator
    if (code[i] === '@') {
      const start = i++;
      while (i < len && /[\w$]/.test(code[i])) i++;
      tokens.push({ type: 'decorator', value: code.slice(start, i), index: start });
      continue;
    }
    // Template literal
    if (code[i] === '`') {
      const start = i++;
      while (i < len && code[i] !== '`') {
        if (code[i] === '\\') i++;
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: code.slice(start, i), index: start });
      continue;
    }
    // String
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      const start = i++;
      while (i < len && code[i] !== q) {
        if (code[i] === '\\') i++;
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: code.slice(start, i), index: start });
      continue;
    }
    // Number
    if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      const start = i;
      while (i < len && /[0-9._xXeEbBoOnN]/.test(code[i])) i++;
      tokens.push({ type: 'number', value: code.slice(start, i), index: start });
      continue;
    }
    // Word (keyword / type / identifier)
    if (/[a-zA-Z_$]/.test(code[i])) {
      const start = i;
      while (i < len && /[\w$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      let type: TokenType = 'variable';
      if (word === 'true' || word === 'false') type = 'boolean';
      else if (KEYWORDS.has(word)) type = 'keyword';
      else if (TYPES.has(word)) type = 'type';
      // function call?
      else if (/[\w$]/.test(word[0]) && code[i] === '(') type = 'function';
      tokens.push({ type, value: word, index: start });
      continue;
    }
    // Operator
    if (/[+\-*/%=<>!&|^~?:.]/.test(code[i])) {
      const start = i;
      while (i < len && /[+\-*/%=<>!&|^~?:.]/.test(code[i])) i++;
      tokens.push({ type: 'operator', value: code.slice(start, i), index: start });
      continue;
    }
    // Punctuation
    if (/[{}[\](),;]/.test(code[i])) {
      tokens.push({ type: 'punctuation', value: code[i], index: i });
      i++;
      continue;
    }
    // Whitespace / anything else — plain
    const start = i;
    while (
      i < len &&
      !/[a-zA-Z_$0-9@`"'\/+\-*/%=<>!&|^~?:.{}[\](),;]/.test(code[i])
    ) i++;
    if (i === start) i++; // safety
    tokens.push({ type: 'plain', value: code.slice(start, i), index: start });
  }

  return tokens;
}
