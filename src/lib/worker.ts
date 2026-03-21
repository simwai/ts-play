import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import * as TS from 'typescript';

let isEsbuildInitialized = false;
let workerInitializationPromise: Promise<void> | undefined;

const virtualFiles: Record<string, { version: number; content: string }> = {};

function generateAmbientDeclarations(sourceCode: string): string {
  try {
    return (
      '// Declarations auto-generated from main.ts\n' +
      sourceCode
        .split('\n')
        .filter((l) => l.startsWith('export'))
        .join('\n')
    );
  } catch (err) {
    console.error('generateAmbientDeclarations error:', err);
    return '// Error generating declarations';
  }
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

globalThis.onmessage = async (messageEvent: MessageEvent) => {
  const { id, type, payload } = messageEvent.data;
  try {
    let result: any;

    switch (type) {
      case 'INIT': {
        workerInitializationPromise ||= (async () => {
          if (!isEsbuildInitialized) {
            await esbuild.initialize({
              wasmURL: esbuildWasmUrl,
              worker: false,
            });
            isEsbuildInitialized = true;
          }
        })();
        await workerInitializationPromise;
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
