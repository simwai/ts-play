<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Architecture: TSPlay

A high-performance, browser-native TypeScript development environment.

## 🎨 Core Design Principles

- **Single-Page Simplicity**: A focused, responsive UI that prioritizes code space.
- **Worker-First Processing**: Offloading TypeScript Language Service and `esbuild` compilation to a dedicated Web Worker to maintain UI responsiveness.
- **WebContainer Sandbox**: Utilizing Node.js-in-the-browser for high-fidelity execution and actual `npm` package support.
- **Themed Experience**: Deep integration with Catppuccin and other popular syntax themes, spanning both the UI and the Monaco editor.

## 📦 Package Management & Type Acquisition

The playground implements a dual-layer strategy for managing dependencies and types:

### 1. The Reconciliation Loop

To prevent "process storms" when users type rapidly, the `usePackageManager` hook utilizes a target-state reconciliation loop:

- **Debounced Detection**: Import statements are detected after a 2500ms settle period.
- **Batching**: All necessary additions and removals are calculated and executed in single `npm install` or `npm uninstall` commands.
- **Auto-Discovery**: The system automatically queries the npm registry for corresponding `@types/` packages and installs them alongside the main package.

### 2. Dual-Layer Typings

Types are provided to the Monaco editor from two sources:

- **ATA (Automatic Type Acquisition)**: Provides immediate, high-level types for the editor's Language Service.
- **Container Sync**: After `npm` operations, the system recursively reads `.d.ts` files directly from the WebContainer's `node_modules` and injects them into the editor's virtual filesystem for 100% execution-to-editor parity.

## 🚀 Execution Pipeline

1. **Compilation**: Source code is passed to the Worker where `esbuild-wasm` generates JS and the TS Language Service generates `.d.ts` declarations.
2. **Mounting**: Compiled assets are written to the WebContainer's virtual filesystem.
3. **Execution**: The WebContainer spawns a `node` process. Output is streamed back to the UI Console with support for ANSI color codes and yielding mechanisms to prevent UI starvation.

## 🛠️ Tech Stack Breakdown

| Layer         | Technology                                |
| :------------ | :---------------------------------------- |
| **Framework** | React 19 (ESM)                            |
| **Styling**   | Tailwind CSS (Catppuccin Palette)         |
| **Editor**    | Monaco Editor                             |
| **Bundler**   | esbuild-wasm                              |
| **Runtime**   | @webcontainer/api                         |
| **State**     | Custom Observable Store (PlaygroundStore) |
