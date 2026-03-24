# 🏗️ TSPlay Architecture

TSPlay is built on a "WebContainer-as-Source-of-Truth" architecture, refined with Clean Code principles and a centralized State Management system.

## 核心 (Core) - PlaygroundStateManager

The `PlaygroundStateManager` (`src/lib/state-manager.ts`) is the Single Source of Truth (SSOT). It manages:

- **Environment Lifecycle**: `IDLE -> BOOTING -> MOUNTING -> INSTALLING -> COMPILING -> READY`.
- **Compiler Status**: Real-time status of `tsc` and `esbuild` background processes.
- **User Preferences**: Theme, Line Wrap, and ANSI Stripping settings (persisted to LocalStorage).
- **Operation Queue**: A promise-based queue that ensures all environment mutations are sequential and race-condition free.

## 📦 Services - WebContainerService

The `WebContainerService` (`src/lib/webcontainer.ts`) is a thin wrapper around the @webcontainer/api. It provides:

- **Managed Process Spawning**: `spawnManaged` handles output decoding, line-buffering, and ANSI sequence detection.
- **File Orchestration**: High-level methods for mounting snapshots and reading/writing files.
- **Task Enqueueing**: All actions are funneled through the `PlaygroundStateManager` queue.

## 🪝 Hooks - The Orchestration Layer

- **useWebContainer**: Coordinates the boot sequence, environment preparation, and background compiler startup.
- **useCompilerManager**: Manages the "Run" flow, ensuring execution only proceeds when the SSOT reports the environment is `READY`.
- **usePackageManager**: Monitors imports in the editor and automatically synchronizes `node_modules` in the container.

## 🎨 Components - React View Layer

Components are "dumb" consumers of the SSOT via `usePlaygroundStore`.

- **App**: The root layout, reacting to theme changes and managing top-level state.
- **CodeEditor**: A Monaco-based editor that treats the WebContainer filesystem as its remote source.
- **Console**: Renders logs with an optional ANSI stripping filter.
- **SettingsModal**: A direct interface for modifying the SSOT preferences.

## 🧪 Testing Strategy

- **Unit Tests**: Vitest for critical logic like ANSI stripping (`src/lib/ansi.test.ts`).
- **E2E Tests**: Playwright for "Happy Path" verification (Load -> Wait -> Run -> Output).
- **Visual Regression**: Screenshot testing to prevent layout/theme breaks.

---

*Refactored with ❤️ by Jules, following the wisdom of Uncle Bob, Martin Fowler, and Kent C. Dodds.*
