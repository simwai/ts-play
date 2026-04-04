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

## 2025-05-22: Blocked Native Context Menu on Mobile

- **Issue**: The browser's native context menu (for copy/paste/share) was blocked when long-pressing words in the editor on mobile devices.
- **Cause**: Monaco Editor's custom hover tooltips and its internal context menu were intercepting the long-press event.
- **Solution**:
  1. Specifically disabled Monaco's hover and context menu when `isMobileLike` is true.
  2. Continued to provide essential symbol information via the Type Info Bar.

## 2025-05-22: Horizontal Scroll Blocked by Swipe Gesture

- **Issue**: Horizontal scrolling in the code editor (when line wrap was disabled) was impossible because any horizontal swipe was intercepted by the tab-switching logic.
- **Cause**: `useSwipeTabs` was listening for touches on the entire editor container and didn't have specific enough exclusion logic.
- **Solution**:
  1. Restructured `App.tsx` to place the swipe listener on the root container.
  2. Refined `useSwipeTabs` to only trigger tab switches when the swipe originates from the Header, StatusBar, or TypeInfoBar/Console Header.
  3. Excluded the Editor area from the swipe trigger.

## 2025-05-22: Chrome Browser Crash (Black Screen) on "Run"

- **Issue**: Clicking "Run" would occasionally cause the browser tab to crash (turning completely black) on mobile Chrome.
- **Cause**: Rapid, high-volume terminal output from the WebContainer was saturating the UI thread.
- **Solution**:
  1. Implemented a yielding mechanism in `WebContainerService.spawnManaged`.
  2. Added a `setTimeout(resolve, 0)` yield after processing batches of output lines.

## 2025-05-22: Type Info Bar "Empty Box" and Inaccurate Info

- **Issue**: The Type Info Bar sometimes displayed an empty box for the "kind" tag, or failed to extract the symbol name correctly.
- **Cause**:
  1. Brittle regex-based name extraction in `CodeEditor.tsx`.
  2. Missing mappings for many `ScriptElementKind` values.
  3. Inconsistent logic between the Worker and the Editor.
- **Solution**:
  1. Synchronized name extraction logic using `displayParts.find(p => SYMBOL_KINDS.has(p.kind))`.
  2. Expanded the `getKindLabel` and color/style mappings in `TypeInfoBar.tsx`.
  3. Added fallbacks for empty names and handled 'keyword' kind specifically.

## 2025-05-22: Syntax Theme Selection Regression

- **Issue**: The ability to select syntax themes was accidentally removed during a UI simplification pass.
- **Cause**:
  1. Removal of the theme dropdown in `SettingsModal.tsx`.
  2. `CodeEditor.tsx` was using hardcoded logic to switch themes.
- **Solution**:
  1. Restored the "Syntax Theme" dropdown in `SettingsModal.tsx`.
  2. Updated `CodeEditor.tsx` to directly apply the `themeMode` string to Monaco's theme.
  3. Ensured `themeMode` and `setThemeMode` are correctly propagated from `App.tsx`.

## 2025-05-22: Non-working .d.ts Emission

- **Issue**: The `.d.ts` tab often showed manually filtered "export" lines rather than accurate TypeScript declaration files.
- **Cause**: The `COMPILE` action in `worker.ts` was using a simple regex-based helper instead of the Language Service.
- **Solution**:
  1. Enabled `declaration: true` in `compilerOptions`.
  2. Updated the `COMPILE` message handler to call `languageService.getEmitOutput('main.ts', true)` and extract the `.d.ts` file from the output.

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

## 2025-05-25: ansi-to-html Crash and Worker Instability

- **Issue**: The application would occasionally crash or the worker would fail to provide type information.
- **Cause**:
  1. The `ansi-to-html` library crashed with `TypeError: Cannot read properties of undefined (reading '3')` when encountering certain ANSI escape sequences.
  2. The TypeScript worker could fail if `getQuickInfoAtPosition` or `getEmitOutput` returned objects with missing properties (like `tags` or `displayParts`) or threw errors during high-frequency updates.
  3. High-frequency cursor moves and typing caused excessive re-renders of the root `App` component due to cursor position being kept in state.
- **Solution**:
  1. Wrapped `ansiConvert.toHtml` in a `try/catch` block in `Console.tsx`.
  2. Hardened `worker.ts` with explicit null/undefined checks for all Language Service results and added `try/catch` around `getEmitOutput`.
  3. Extracted the cursor position and type information display into a new `TypeInfoBar` component, significantly reducing re-render overhead of the main `App` component.
