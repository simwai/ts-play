<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# COLLECTED PRINCIPLES

## General Principles

- **Documentation First**: Always maintain up-to-date documentation in the `docs/` folder.
- **Bug Logging**: Document complex bugs and their solutions in `BUG_LOG.MD`.
- **Language Service Consistency**: Use standardized absolute paths (e.g., `'/main.ts'`) when interacting with the TypeScript Language Service.
- **Symbol Info Robustness**: Prefer `displayParts` over regex for symbol name extraction in the editor and worker.
- **Path Normalization**: Consistently normalize paths across the frontend, worker, and WebContainer filesystem to ensure seamless inter-process communication.

## Theme & UI Principles

- **Theme Persistence**: The application maintains separate persisted states for preferred dark and light syntax themes.
- **Mode-Aware Theme Selection**: The syntax theme selection in settings is filtered to match the current global dark/light mode.
- **Mobile UX**: On mobile devices, native browser behaviors (like the long-press context menu) should be preserved by disabling Monaco's custom context menu and setting `domReadOnly: false` to allow the soft keyboard to open while still enabling native selection.
- **Compact UI**: Mobile screens require tight spacing. Headers and status bars should use minimal padding and height to maximize vertical space for the editor and console.

## Documentation Maintenance

- All documentation files should have an agent prompt at the top to encourage continuous updates.
- Documentation filenames must be in UPPER_CASE_SNAKE_CASE with the `.MD` extension.
- **Package Reconciliation**: The package manager uses a target-state reconciliation loop to minimize npm operations, batching multiple changes into single commands after a settle period.
- **Type Discovery**: Automatic discovery and installation of @types packages in the runtime environment ensures consistent behavior between the editor and the execution sandbox.
- **Semantic Cache Management**: When injecting new library files (`extraLibs`) into the TypeScript worker, always call `languageService.cleanupSemanticCache()` to ensure new types are resolved immediately.

## Stability and Resilience

- **Storage Guarding**: Always wrap `localStorage` operations in try-catch blocks to prevent security or quota exceptions from crashing the application.
- **Global Error Handling**: Use a root-level `ErrorBoundary` to prevent the entire React application from unmounting and displaying a "black screen" when a component fails to render.
- **Synchronous Theme Initialization**: Apply the user's preferred theme (`dark` class) via a blocking script in `index.html` to prevent FOUC (Flash of Unstyled Content) and ensure the correct theme is applied before the first paint.
- **Idempotent Initialization**: The WebContainer service should handle all filesystem initialization (like writing the base `package.json`) to avoid race conditions or conflicting files from multiple initialization sites.
