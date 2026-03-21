import * as esbuild from 'esbuild-wasm';
import * as TS from 'typescript';

// Use CDN URL for WASM to ensure it's always accessible and avoids build inlining issues
const ESBUILD_WASM_URL = 'https://unpkg.com/esbuild-wasm@0.23.1/esbuild.wasm';

let isEsbuildInitialized = false;
let workerInitializationPromise: Promise<void> | undefined;

const ensureEsbuildInitialized = async () => {
  if (isEsbuildInitialized) return;

  workerInitializationPromise ||= (async () => {
    try {
      await esbuild.initialize({
        wasmURL: ESBUILD_WASM_URL,
        worker: false,
      });
      isEsbuildInitialized = true;
    } catch (err) {
      console.error('Failed to initialize esbuild:', err);
      workerInitializationPromise = undefined; // Allow retry
      throw err;
    }
  })();

  return workerInitializationPromise;
};

const virtualFiles: Record<string, { version: number; content: string }> = {};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload } = messageEvent.data;

  try {
    let result: any;

    switch (type) {
      case 'INIT': {
        await ensureEsbuildInitialized();
        result = true;
        break;
      }

      case 'UPDATE_FILE': {
        const { content, filename = 'main.ts' } = payload;
        const fileState = virtualFiles[filename];
        if (!fileState || fileState.content !== content) {
          virtualFiles[filename] = {
            version: (fileState?.version || 0) + 1,
            content,
          };
        }
        result = true;
        break;
      }

      case 'VALIDATE_CONFIG': {
        const { tsconfig } = payload;
        const parsed = TS.parseConfigFileTextToJson('tsconfig.json', tsconfig);
        if (parsed.error) {
          result = {
            valid: false,
            error: TS.flattenDiagnosticMessageText(
              parsed.error.messageText,
              '\n',
            ),
          };
        } else {
          result = { valid: true };
        }
        break;
      }

      case 'COMPILE': {
        await ensureEsbuildInitialized();
        const compiled = await esbuild.build({
          bundle: false,
          format: 'esm',
          target: 'es2020',
          write: false,
          stdin: {
            contents: payload.code,
            loader: 'ts',
            sourcefile: 'main.ts',
          },
        });

        const lines = payload.code.split('\n');
        const dtsLines = lines.filter((l) => {
          const t = l.trim();
          return (
            t.startsWith('export ') ||
            t.startsWith('interface ') ||
            t.startsWith('type ') ||
            t.startsWith('declare ')
          );
        });

        result = {
          js: compiled.outputFiles?.[0]?.text || '',
          dts: dtsLines.join('\n') || '// No declarations found',
        };
        break;
      }

      case 'DETECT_IMPORTS': {
        const sourceFile = TS.createSourceFile(
          'temp.ts',
          payload.code,
          TS.ScriptTarget.Latest,
          true,
        );
        const imports = new Set<string>();
        const visit = (node: TS.Node) => {
          if (
            TS.isImportDeclaration(node) &&
            TS.isStringLiteral(node.moduleSpecifier)
          ) {
            const m = node.moduleSpecifier.text;
            if (!m.startsWith('.') && !m.startsWith('/')) {
              const parts = m.split('/');
              imports.add(
                m.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0],
              );
            }
          }
          TS.forEachChild(node, visit);
        };
        visit(sourceFile);
        result = [...imports];
        break;
      }

      case 'UPDATE_CONFIG':
      case 'UPDATE_EXTRA_LIBS':
        // No-op in custom worker, handled by Monaco now
        result = true;
        break;

      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }
    self.postMessage({ id, success: true, payload: result });
  } catch (error) {
    console.error(`Worker error [${type}]:`, error);
    self.postMessage({ id, success: false, error: getErrorMessage(error) });
  }
};
