<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Complex Bug Log

## 2025-05-24: Missing Types for Bundled Packages (zod, node-cron)

- **Issue**: Red squiggles in the editor for packages like `zod` and `node-cron`, and `MODULE_TYPELESS_PACKAGE_JSON` warning in Node.js logs.
- **Cause**:
  1. The WebContainer was missing a root `package.json` with `"type": "module"`, leading to Node.js warnings and potential ESM resolution issues.
  2. The package manager was only syncing `.d.ts` files, but modern packages (like `zod`) define their type entry points in `package.json`.
  3. ATA (Automatic Type Acquisition) was explicitly blocked from loading files into `/node_modules/`, preventing it from providing types when the WebContainer sync was incomplete.
  4. The TypeScript compiler options in the editor and worker were using legacy `NodeJs` resolution instead of `NodeNext`.
- **Solution**:
  1. Modified `WebContainerService` to write a root `package.json` with `"type": "module"` on boot.
  2. Updated `usePackageManager` to sync both `.d.ts` and `package.json` files from `node_modules`.
  3. Removed the ATA restriction on `/node_modules/` paths to allow it to supplement the local type definitions.
  4. Updated all TS compiler options to use `NodeNext` module resolution.

## 2025-05-24: Excessive NPM Installs and Missing @types

- **Issue**: Rapid typing caused dozens of queued npm installs/uninstalls. @types packages were not being installed automatically in the WebContainer.
- **Cause**:
  1. Short debounce (1s) in import detection.
  2. Sequential execution of every individual import change without batching or cancellation.
  3. No logic to check for or include @types packages in the install command.
- **Solution**:
  1. Increased import detection debounce to 2500ms.
  2. Implemented a target-state reconciliation loop that batches all additions and removals into single npm commands.
  3. Added an npm registry check to verify package existence and automatically discover/install @types/ versions.
  4. Added warnings (controllable via settings) for missing packages or types.

## 2025-05-23: A.codePointAt is not a function (Worker Crash)

- **Issue**: The application would crash with `Error: A.codePointAt is not a function` in the worker, and `t.create is not a function` in the main thread when opening settings.
- **Cause**:
  1. `useLocalStorage` was aggressively parsing any stored item as JSON if `JSON.parse` didn't throw, or if it wasn't a string.
  2. `tsConfigString` (a JSON string) was being parsed into a JavaScript object by `useLocalStorage`.
  3. The background worker expected a string for `UPDATE_CONFIG`, but received an object, leading to failures in the compiler.
  4. `SettingsModal` was passing undefined props (`hideTypeInfo`, `disableDiagnostics`) to `CodeEditor`.
- **Solution**:
  1. Modified `useLocalStorage` to skip JSON parsing if the `initialValue` is a string.
  2. Enhanced `CodeEditor` to explicitly support and implement `hideTypeInfo`, `disableDiagnostics`, and `disableShortcuts`.
  3. Implemented proper diagnostic toggling in Monaco for both TypeScript and JSON editors.

## 2025-05-22: Blocked Native Context Menu and Keyboard on Mobile

- **Issue**: The browser's native context menu was blocked and the keyboard didn't open on mobile.
- **Cause**: `domReadOnly: true` was used to allow native selection but blocked the keyboard. Monaco's internal context menu was also intercepting long-press.
- **Solution**:
  1. Set `domReadOnly: false` and `contextmenu: false` in Monaco options.
  2. Forced `userSelect: text` on the editor container.
  3. Disabled `autoImports` and `importSuggestions` in TypeScript compiler options to prevent auto-import code insertion while keeping IntelliSense.

## 2025-05-22: Delayed/Stale Type Information

- **Issue**: Types installed via npm were not immediately visible (red squiggles remained).
- **Cause**: The TypeScript Language Service in the worker was caching semantic information and not properly clearing it when new library files (`extraLibs`) were injected.
- **Solution**:
  1. Added `languageService.cleanupSemanticCache()` in the worker when `UPDATE_EXTRA_LIBS` or `UPDATE_CONFIG` is received.
  2. Reduced debouncing in `usePackageManager` (1000ms), `useTSDiagnostics` (100ms), and ATA syncing (100ms) for a more "real-time" experience.

## 2025-05-22: "Black Screen of Death" Crash

- **Issue**: The entire page would turn black (or dark background color) and become unresponsive, especially in Private Browsing or restricted environments.
- **Cause**:
  1. `useLocalStorage` accessed `localStorage` without guards, throwing a `SecurityError` in restricted contexts.
  2. Lack of an `ErrorBoundary` caused React to unmount the entire application upon any render-phase error.
- **Solution**:
  1. Added try-catch guards to all `localStorage` access in `useLocalStorage.ts`.
  2. Wrapped the root application in an `ErrorBoundary` in `main.tsx`.
  3. Added a blocking inline script in `index.html` to apply the theme class before the first paint, preventing FOUC.
  4. Removed redundant and conflicting `package.json` writing logic from `App.tsx` to simplify initialization.
