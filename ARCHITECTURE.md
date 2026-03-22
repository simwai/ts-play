# Architecture Documentation

## WebContainer Queue System

The TypeScript Playground implements a centralized operation queue in `src/lib/webcontainer.ts` to handle the asynchronous and sequential nature of browser-based WebContainer environments.

### Why a Queue?
1. **Concurrency Control**: `npm install` and other filesystem-intensive tasks in WebContainer cannot safely run concurrently.
2. **Readiness Guarantee**: All user-triggered operations (Run, Format, Install) must wait for the environment to boot and for system-level dependencies to be ready.
3. **Sequential Logic**: Depedency management must happen in order (Uninstall then Install) before a script can be reliably executed.

### How it Works
The `WebContainerService` provides an `enqueue<T>(operation)` method:
- It maintains a `Promise` chain (`operationQueue`).
- Each new task is appended to the chain.
- It automatically waits for `envReady` before executing user-queued tasks.
- It provides a `enqueueSystem<T>(operation)` for tasks that must run before the environment is fully marked as "ready" (e.g., initial boot install).

### Usage in Hooks
- `useWebContainer.ts`: Enqueues the initial boot and setup.
- `usePackageManager.ts`: Enqueues npm operations based on detected import changes.
- `useCompilerManager.ts`: Enqueues `vite-node` execution, ensuring it runs *after* any pending installations.

## Layout & Interaction
- **Header**: Main navigation and primary actions (Run, Share, Format).
- **StatusBar**: Contextual actions (Undo, Redo, Settings) and status indicators. Now positioned at the top.
- **TypeInfoBar**: Displays cursor position and inferred TypeScript types in real-time above the resizer.
- **Console**: Buffered output stream from WebContainer processes with ANSI support and whitespace sanitization.
