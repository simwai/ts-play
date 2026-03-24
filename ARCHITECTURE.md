# Architecture Documentation

## Reactive Compilation Workflow

The TypeScript Playground implements a "WebContainer-as-Source-of-Truth" architecture for compilation and execution.

### Reactive Cycle
1. **Source Update**: When the user edits code in Monaco, the `useWebContainer` hook automatically writes the `index.ts` to the WebContainer filesystem.
2. **Background Compilation**: A persistent `tsc --watch` process running inside the WebContainer detects the filesystem change and emits `dist/index.js` and `dist/index.d.ts`.
3. **Filesystem Watcher**: The `useWebContainer` hook uses `instance.fs.watch` to monitor the `dist` directory. When artifacts are emitted, it synchronizes them back to the React state (`jsCode`, `dtsCode`).
4. **Execution**: When "Run" is clicked, `useCompilerManager` executes the pre-compiled `dist/index.js` directly using the standard `node` binary inside the container.

### Benefits
- **Stability**: Avoids complex runtime wrappers like `vite-node` or `tsx` during execution.
- **Accuracy**: Emitted JS and DTS always match what the official TypeScript compiler produces for the given `tsconfig.json`.
- **Performance**: Execution is near-instant because compilation has already happened in the background.

## WebContainer Queue System

A centralized operation queue in `WebContainerService` ensures that all asynchronous operations (initial setup, `npm install`, `node` execution) happen in the correct order and wait for environment readiness.

## Layout & Interaction
- **StatusBar**: Positioned at the top for quick access to Undo/Redo/Settings.
- **TypeInfoBar**: Real-time display of cursor position and TypeScript types above the draggable resizer.
- **Console**: Robust output streaming with line-buffering and ANSI sequence sanitization.
