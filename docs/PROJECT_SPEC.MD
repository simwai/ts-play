<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Project Specification: TypeScript Playground

## Overview
A web-based TypeScript playground built with React 19, Vite, and @webcontainer/api. It allows users to write, compile, and run TypeScript code directly in the browser using a sandboxed WebContainer environment.

## Key Features
- **Real-time Compilation**: Powered by `esbuild-wasm` and the TypeScript Language Service.
- **WebContainer Sandbox**: High-fidelity execution environment using `node` within the browser.
- **Monaco Editor Integration**: Rich IDE features including autocomplete, diagnostics, and type information.
- **Type Information Bar**: A dedicated UI component that displays detailed information about the symbol under the cursor (kind, name, type, and JSDoc).
- **Package Management**: Install and use npm packages in the playground.
- **Customizable Environment**: Configurable `tsconfig.json` and syntax themes (Catppuccin Mocha, Latte, Monokai, Shades of Purple, GitHub Dark/Light).
- **Sharing**: Compressed URL-based sharing and server-side snippet storage.

## Architecture
- **WebContainerService**: Centralized management of the WebContainer instance, file system, and process execution.
- **Worker**: A Web Worker that handles heavy-lifting tasks like TypeScript diagnostics, type information extraction, and esbuild compilation.
- **PlaygroundStore**: A simple observable state machine (using a custom implementation) for application-wide state management.

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Lucide React, Radix UI (implicitly via tailwind/custom components).
- **Editor**: Monaco Editor (@monaco-editor/react).
- **Runtime**: @webcontainer/api.
- **Tooling**: Vite, Vitest, Playwright (for E2E).
