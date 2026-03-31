<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

<div style="background-color: #1e1e2e; color: #cdd6f4; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #cba6f7; font-family: 'JetBrains Mono', monospace; line-height: 1.6;">

# <span style="color: #cba6f7; font-size: 2.5rem;">✨ Architecture Overview</span>

<p style="color: #94e2d5; font-style: italic; margin-bottom: 2rem;">A high-fidelity, browser-native TypeScript development environment.</p>

---

## <span style="color: #fab387;">🏗️ System Design</span>

TSPlay utilizes a multi-threaded architecture to ensure a fluid user experience even during intensive compilation tasks.

### <span style="color: #89b4fa;">1. The UI Thread (React 19)</span>

- **State Management**: Uses an observable `PlaygroundStore` for real-time reactivity without the overhead of heavy global libraries.
- **Editor**: Powered by Monaco, with custom logic for real-time type info extraction and cursor-based synchronization.
- **Sandbox Orchestration**: Manages the WebContainer lifecycle via `WebContainerService`.

### <span style="color: #89b4fa;">2. The TypeScript Worker</span>

- **Diagnostics**: Runs the full TS Language Service to provide deep semantic errors.
- **Compilation**: Leverages `esbuild-wasm` for near-instant JS emission.
- **Module Resolution**: Implements a virtual filesystem that mirrors the WebContainer's `node_modules`, ensuring perfect parity between what you see and what you run.

---

## <span style="color: #fab387;">📦 The Package Reconciliation Engine</span>

The playground implements a robust, state-based reconciliation loop for dependencies:

- **Debounced Detection**: Wait for 2500ms of user inactivity before analyzing imports.
- **State Merging**: Collapses multiple addition/removal actions into a single reconciliation task.
- **Batch Execution**: Spawns a single `npm install` or `npm uninstall` command for all changes, minimizing WebContainer overhead.
- **Auto-Types Discovery**: Automatically finds and installs `@types/` packages by querying the npm registry.

---

## <span style="color: #fab387;">📂 Dual-Layer Type Synchronization</span>

To provide 100% accurate autocomplete and hover info, TSPlay uses two parallel systems:

1. **ATA (Automatic Type Acquisition)**: Queries CDNs to provide immediate types for standard packages during typing.
2. **WebContainer Sync**: After an install, the system recursively crawls the `node_modules` folder inside the WebContainer, reading `.d.ts` and `package.json` files. These are injected into the editor's virtual filesystem, allowing Monaco to resolve types exactly as Node.js would.

---

## <span style="color: #fab387;">⚡ Execution Sandbox</span>

- **Runtime**: @webcontainer/api provides a real Node.js environment in the browser.
- **Streaming Output**: Logs are streamed from the sandbox to the UI with ANSI support and yielding mechanisms to prevent browser hangs.
- **FileSystem**: A virtual FS that persists throughout the session, allowing for complex multi-file scenarios.

</div>
