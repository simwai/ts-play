<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# ts-play Architecture

## Table of Contents

- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow](#data-flow)
- [Key Abstractions](#key-abstractions)
- [Module Boundaries](#module-boundaries)
- [Tech Stack Rationale](#tech-stack-rationale)
- [Architecture Flags](#architecture-flags)
- [Glossary](#glossary)

## Overview

ts-play is a browser-based TypeScript development environment built with React 19, Vite, and @webcontainer/api. The application is structured around three core abstractions: **WebContainerService**, **Worker**, and **PlaygroundStore**.

## Component Hierarchy

```
App.tsx (root)
├── Header.tsx
│   ├── Toolbar.tsx
│   └── Tab strip
├── CodeEditor.tsx (Monaco Editor)
├── BottomPanel.tsx
│   ├── Console.tsx
│   ├── Problems.tsx
│   ├── PackageManager.tsx
│   └── Resize divider
├── SettingsModal.tsx
├── Modal.tsx (generic overlay)
└── ErrorBoundary.tsx
```

**Hooks** (consumed by App.tsx):

- `useCompilerManager` — manages esbuild compilation lifecycle
- `usePackageManager` — handles npm install/uninstall and import detection
- `useShareFlow` — handles URL-based and server-side sharing
- `useClipboardActions` — copy/delete all code
- `useKeyboardShortcuts` — keyboard shortcut handling
- `useWebContainerBoot` — WebContainer initialization
- `useVirtualKeyboard` — mobile keyboard detection
- `useResizePanel` — panel height management
- `useSwipeTabs` — tab switching via swipe gestures
- `useConsoleManager` — console output management
- `useLocalStorage` — persistent state storage
- `useLongPressTooltip` — mobile long-press type info

**Lib services** (called by hooks and components):

- `WebContainerService` (webcontainer.ts) — singleton, manages WebContainer instance
- `PlaygroundStore` (state-manager.ts) — observable state machine
- `Worker` (worker.ts) — thin router, delegates to monacoProtocol and customMessages
- `languageService` (languageService.ts) — TypeScript Language Service setup
- `monacoProtocol` (monacoProtocol.ts) — Monaco method handlers
- `customMessages` (customMessages.ts) — Custom message handlers
- `virtualFs` (virtualFs.ts) — Virtual filesystem helpers
- `workerClient` (workerClient.ts) — Client-side worker communication
- `theme` (theme.ts) — Theme management
- `errors` (errors.ts) — Error handling utilities
- `shareCodec` (shareCodec.ts) — Share payload encoding/decoding
- `shareUrl` (shareUrl.ts) — Share URL builders
- `formatter` (formatter.ts) — Code formatting with Prettier
- `packageDiff` (packageDiff.ts) — Package diff computation
- `regex` (regex.ts) — Regex utilities
- `constants` (constants.ts) — Shared constants
- `types` (types.ts) — Type definitions

### Architecture Diagram

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#1e1b4b', 'primaryTextColor': '#e0e0e0', 'primaryBorderColor': '#7c3aed', 'lineColor': '#a78bfa', 'secondaryColor': '#2d1b69', 'tertiaryColor': '#0f0f23', 'fontSize': '14px'}}}%%
graph TD
    A[App.tsx] --> B[Header.tsx]
    A --> C[CodeEditor.tsx]
    A --> D[BottomPanel.tsx]
    A --> E[SettingsModal.tsx]
    A --> F[ErrorBoundary.tsx]
    B --> B1[Toolbar.tsx]
    D --> D1[Console.tsx]
    D --> D2[Problems.tsx]
    D --> D3[PackageManager.tsx]

    A --> H[useCompilerManager]
    A --> P[usePackageManager]
    A --> S[useShareFlow]
    A --> K[useKeyboardShortcuts]
    A --> W[useWebContainerBoot]
    A --> V[useVirtualKeyboard]

    H --> W1[worker.ts]
    P --> W2[WebContainerService]
    W --> W2
    W --> W3[languageService.ts]
    W1 --> W4[monacoProtocol.ts]
    W1 --> W5[customMessages.ts]
    W2 --> W6[@webcontainer/api]
    W3 --> W7[TypeScript Language Service]

    A --> G[PlaygroundStore]
    G --> G1[State: theme, code, status]

    style A fill:#1e1b4b,stroke:#7c3aed
    style G fill:#2d1b69,stroke:#7c3aed
    style W2 fill:#2d1b69,stroke:#7c3aed
    style W3 fill:#2d1b69,stroke:#7c3aed
    style C fill:#1e1b4b,stroke:#7c3aed
    style D fill:#1e1b4b,stroke:#7c3aed

    classDef layer fill:#1e1b4b,stroke:#7c3aed,color:#e0e0e0
    classDef service fill:#2d1b69,stroke:#a78bfa,color:#e0e0e0
    classDef hook fill:#0f0f23,stroke:#7c3aed,color:#e0e0e0

    class A,C,D,B,B1,D1,D2,D3,E,F layer
    class W2,W3,W1,W4,W5,W6,W7 service
    class H,P,S,K,W,V hook
```

## Data Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#1e1b4b', 'primaryTextColor': '#e0e0e0', 'primaryBorderColor': '#7c3aed', 'lineColor': '#a78bfa', 'secondaryColor': '#2d1b69', 'tertiaryColor': '#0f0f23', 'fontSize': '13px'}}}%%
flowchart LR
    subgraph UI["👤 User Interface"]
        CE[CodeEditor<br/>Monaco]
        PM[PackageManager]
        SC[Share Flow]
    end

    subgraph H["🪝 Hooks"]
        HC[useCompilerManager]
        HP[usePackageManager]
        HS[useShareFlow]
        HW[useWebContainerBoot]
    end

    subgraph L["⚙️ Lib Services"]
        WS[WebContainerService<br/>Singleton]
        LS[LanguageService<br/>TS API]
        MP[MonacoProtocol<br/>Worker Methods]
        CM[CustomMessages<br/>Worker Methods]
        PS[PlaygroundStore<br/>State Machine]
    end

    subgraph R["🔧 Runtime"]
        EW[esbuild-wasm<br/>Compiler]
        WC[@webcontainer/api<br/>Node.js]
        TS[TypeScript<br/>Language Service]
    end

    UI --> H
    H --> L
    L --> R

    CE -->|user input| HC
    CE -->|imports| HP
    SC --> HS

    HC -->|compile| MP
    HC -->|diagnostics| LS
    HP -->|install| WS
    HW -->|boot| WS

    MP -->|monaco methods| TS
    CM -->|custom actions| EW
    LS -->|type info| TS

    WS -->|file ops| WC
    HC -->|state| PS
    PS -->|updates| UI

    style UI fill:#1e1b4b,stroke:#7c3aed,color:#e0e0e0
    style H fill:#2d1b69,stroke:#a78bfa,color:#e0e0e0
    style L fill:#0f0f23,stroke:#7c3aed,color:#e0e0e0
    style R fill:#1e1b4b,stroke:#7c3aed,color:#e0e0e0

    classDef ui fill:#1e1b4b,stroke:#7c3aed,color:#e0e0e0
    classDef hook fill:#2d1b69,stroke:#a78bfa,color:#e0e0e0
    classDef lib fill:#0f0f23,stroke:#7c3aed,color:#e0e0e0
    classDef runtime fill:#1e1b4b,stroke:#7c3aed,color:#e0e0e0

    class UI ui
    class H hook
    class L lib
    class R runtime
```

1. **User input** → `CodeEditor.tsx` (Monaco) → `useCompilerManager` / `usePackageManager`
2. **Compilation** → `useCompilerManager` → `worker.ts` → `monacoProtocol.ts` / `languageService.ts` → `esbuild-wasm`
3. **WebContainer execution** → `useWebContainerBoot` → `WebContainerService` → `@webcontainer/api` → Node.js process
4. **State updates** → `PlaygroundStore.setState()` → listeners update components
5. **Console output** → `WebContainerService` emits logs → `useConsoleManager` → `Console.tsx`
6. **Diagnostics** → `languageService.ts` → `useCompilerManager` → `Problems.tsx`
7. **Type info** → `languageService.ts` → `useLongPressTooltip` → Type Info Bar
8. **Sharing** → `useShareFlow` → `shareUrl.ts` / `shareCodec.ts` → API or URL

## Key Abstractions

### WebContainerService

A singleton class in `src/lib/webcontainer.ts` that manages the WebContainer instance, file system, and process execution. It handles booting, file operations, process spawning, and log emission. Uses a `bootPromise` pattern to prevent duplicate boots.

**Key methods:**

- `getInstance()` — Returns the WebContainer singleton
- `emitLog()` — Emits log messages to registered callbacks
- `spawnManaged()` — Spawns a process with yielding to prevent UI thread saturation

### PlaygroundStore

An observable state machine in `src/lib/state-manager.ts` that manages application-wide state. It uses a `Promise` queue to serialize state updates and prevent race conditions.

**State shape:**

- `theme`, `tsCode`, `jsCode`, `dtsCode`, `tsConfigString`
- `compilerStatus`, `packageManagerStatus`
- `toasts`, `trueColorEnabled`, `lineWrap`, `showNodeWarnings`

### Worker

A thin Web Worker router in `src/lib/worker.ts` that delegates to `monacoProtocol.ts` and `customMessages.ts`. It uses `globalThis.onmessage` as the entry point and `ensureInitialized` to guarantee the Language Service is ready before processing.

### LanguageService

Managed in `src/lib/languageService.ts`, this abstraction wraps the TypeScript Language Service API. It handles initialization, file updates, and diagnostic retrieval. Uses a singleton pattern with version tracking.

## Module Boundaries

| Layer            | Files             | Responsibility                                      |
| ---------------- | ----------------- | --------------------------------------------------- |
| **Root**         | `App.tsx`         | Orchestration, state composition, hook wiring       |
| **Components**   | `src/components/` | UI rendering, user interaction                      |
| **Hooks**        | `src/hooks/`      | Side effects, state management, event handling      |
| **Lib Services** | `src/lib/`        | Business logic, external API integration, utilities |
| **Utils**        | `src/utils/`      | Pure utility functions                              |
| **Entry**        | `src/main.tsx`    | Application bootstrap                               |

**Rules:**

- Components must not contain business logic — delegate to hooks
- Hooks must not directly manipulate the DOM — use refs sparingly
- Lib services must be singleton or stateless
- No cross-layer imports (components don't import from lib directly, only via hooks)

## Tech Stack Rationale

| Technology                      | Choice          | Rationale                                                 |
| ------------------------------- | --------------- | --------------------------------------------------------- |
| **React 19**                    | UI framework    | Concurrent features, server components, improved suspense |
| **Vite**                        | Build tool      | Fast HMR, native ESM, minimal config                      |
| **@webcontainer/api**           | Runtime         | Browser-based Node.js sandbox, no server needed           |
| **Monaco Editor**               | Code editor     | Industry-standard IDE features, TypeScript integration    |
| **esbuild-wasm**                | Compiler        | Near-instant compilation, WASM-based, browser-native      |
| **TypeScript Language Service** | Diagnostics     | Accurate type checking, autocomplete, hover info          |
| **Tailwind CSS**                | Styling         | Utility-first, configurable, themeable                    |
| **Vitest**                      | Testing         | Native Vite integration, browser testing via Playwright   |
| **Playwright**                  | E2E testing     | Cross-browser, reliable, browser automation               |
| **pnpm**                        | Package manager | Fast, disk-efficient, strict dependency resolution        |

## Architecture Flags

- **High coupling in App.tsx** — The root component currently couples UI, worker, WebContainer, share, clipboard, and settings orchestration. Refactoring tasks target extraction to hooks and components.
- **Pattern concentration** — Error handling and state management patterns are concentrated in `lib/` and `hooks/` with some duplication across files.
- **God file risk** — `App.tsx` exceeds 600 lines and contains >10 `useEffect` blocks. Task-based refactoring targets reduction below 300 lines.

## Glossary

### ATA (Automatic Type Acquisition)

The process of automatically discovering and installing `@types` packages for imported npm packages in the WebContainer runtime. Implemented in `src/hooks/usePackageManager.ts`.

### CompilerStatus

An enum-like type representing the current state of the TypeScript compiler: `loading`, `ready`, `error`. Managed by `PlaygroundStore` and displayed in the header status bar.

### esbuild-wasm

A WebAssembly build tool that compiles TypeScript to JavaScript in the browser. Used for fast compilation without a server. Imported as `esbuild` in the codebase.

### Monaco Protocol

The communication protocol between the main thread and the Monaco Editor's Web Worker. Handles methods like `getCompletions`, `getDiagnostics`, `getHover`, and `getSignatureHelp`. Implemented in `src/lib/monacoProtocol.ts`.

### PlaygroundStore

The observable state machine that manages all application state. Uses a `Promise` queue for serialized updates and a `Set` of listeners for reactive updates. Defined in `src/lib/state-manager.ts`.

### Virtual FS

The virtual filesystem layer that provides a Node.js-compatible file system interface within the WebContainer. Implemented in `src/lib/virtualFs.ts` with helpers like `normalizePath`, `isKnownSourceFile`, `readVirtualFile`.

### WebContainer

A browser-based Node.js runtime provided by `@webcontainer/api`. It allows running Node.js code, installing npm packages, and executing scripts entirely in the browser. Booted via `WebContainer.boot()`.

### WebContainerService

The singleton class that manages the WebContainer instance lifecycle. Handles booting, file operations, process spawning, and log emission. Defined in `src/lib/webcontainer.ts`.

### Worker

The Web Worker that handles heavy computation tasks including TypeScript diagnostics, type information extraction, and esbuild compilation. Acts as a thin router delegating to `monacoProtocol` and `customMessages`. Defined in `src/lib/worker.ts`.

### TypeInfo

The type information displayed when hovering over a symbol in the editor. Includes the symbol name, kind, type annotation, and JSDoc documentation. Retrieved via the TypeScript Language Service's `getQuickInfoAtPosition` API.

### Share Codec

The encoding/decoding mechanism for share payloads. Compresses and encodes code snippets into URL-safe strings for sharing. Implemented in `src/lib/shareCodec.ts`.

### Share URL

The URL builder functions that construct shareable links. Supports server-side snippet storage and compressed URL-based sharing. Implemented in `src/lib/shareUrl.ts`.

### Package Diff

The computation that determines which npm packages need to be installed or uninstalled based on detected imports. Implemented in `src/lib/packageDiff.ts`.

### Custom Messages

The message protocol for non-Monaco communication between the main thread and the Worker. Handles `INIT`, `COMPILE`, `FORMAT`, `SHARE`, and other custom actions. Implemented in `src/lib/customMessages.ts`.
