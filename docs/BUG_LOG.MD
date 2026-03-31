<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Complex Bug Log

## 2025-05-23: A.codePointAt is not a function (Worker Crash)

- **Issue**: The application would crash with `Error: A.codePointAt is not a function` in the worker, and `t.create is not a function` in the main thread when opening settings.
- **Cause**:
  1. `useLocalStorage` was aggressively parsing any stored item as JSON if `JSON.parse` didn't throw, or if it wasn't a string.
  2. `tsConfigString` (a JSON string) was being parsed into a JavaScript object by `useLocalStorage`.
  3. The background worker expected a string for `UPDATE_CONFIG`, but received an object, leading to internal failures in the TypeScript compiler (which expects strings for source/config).
  4. `SettingsModal` was passing undefined props (`hideTypeInfo`, `disableDiagnostics`) to `CodeEditor`, which caused initialization issues.
- **Solution**:
  1. Modified `useLocalStorage` to skip JSON parsing if the `initialValue` is a string. This ensures string-based state (like TSConfig or code) stays as strings.
  2. Enhanced `CodeEditor` to explicitly support and implement `hideTypeInfo`, `disableDiagnostics`, and `disableShortcuts`.
  3. Implemented proper diagnostic toggling in Monaco for both TypeScript and JSON editors.

## 2025-05-22: Blocked Native Context Menu on Mobile

- **Issue**: The browser's native context menu (for copy/paste/share) was blocked when long-pressing words in the editor on mobile devices.
- **Cause**: Monaco Editor's custom hover tooltips and its internal context menu were intercepting the long-press event, even with `domReadOnly` set to true.
- **Solution**:
  1. Specifically disabled Monaco's hover and context menu when `isMobileLike` is true.
  2. Continued to provide essential symbol information via the Type Info Bar.

## 2025-05-22: Horizontal Scroll Blocked by Swipe Gesture

- **Issue**: Horizontal scrolling in the code editor (when line wrap was disabled) was impossible because any horizontal swipe was intercepted by the tab-switching logic.
- **Cause**: `useSwipeTabs` was listening for touches on the entire editor container and didn't have specific enough exclusion logic for interactive regions.
- **Solution**:
  1. Restructured `App.tsx` to place the swipe listener on the root container.
  2. Refined `useSwipeTabs` to only trigger tab switches when the swipe originates from the Header, StatusBar, or TypeInfoBar/Console Header.
  3. Excluded the Editor area from the swipe trigger, allowing it to handle horizontal scrolling naturally.

## 2025-05-22: Chrome Browser Crash (Black Screen) on "Run"

- **Issue**: Clicking "Run" would occasionally cause the browser tab to crash (turning completely black) on mobile Chrome.
- **Cause**: Rapid, high-volume terminal output from the WebContainer (e.g., from Node.js or npm) was saturating the UI thread, leading to a hang or crash.
- **Solution**:
  1. Implemented a yielding mechanism in `WebContainerService.spawnManaged`.
  2. Added a `setTimeout(resolve, 0)` yield after processing batches of output lines to give the browser's event loop a chance to breathe.

## 2025-05-22: Type Info Bar "Empty Box" and Inaccurate Info

- **Issue**: The Type Info Bar sometimes displayed an empty box for the "kind" tag, or failed to extract the symbol name correctly for certain TypeScript constructs (e.g., variables, aliases).
- **Cause**:
  1. Brittle regex-based name extraction in `CodeEditor.tsx`.
  2. Missing mappings for many `ScriptElementKind` values returned by the TypeScript Language Service.
  3. Inconsistent logic between the Worker and the Editor for name extraction.
- **Solution**:
  1. Synchronized name extraction logic using `displayParts.find(p => SYMBOL_KINDS.has(p.kind))`.
  2. Expanded the `getKindLabel` and color/style mappings in `TypeInfoBar.tsx` to cover a wider range of TS symbol kinds (methods, aliases, properties, etc.).
  3. Added fallbacks for empty names and handled 'keyword' kind specifically.

## 2025-05-22: Syntax Theme Selection Regression

- **Issue**: The ability to select syntax themes was accidentally removed during a UI simplification pass. Furthermore, theme changes weren't being correctly applied to the Monaco editor.
- **Cause**:
  1. Removal of the theme dropdown in `SettingsModal.tsx`.
  2. `CodeEditor.tsx` was using hardcoded logic to switch between light/dark themes based on `themeMode`, but was ignoring the specific selected theme (e.g., Monokai).
- **Solution**:
  1. Restored the "Syntax Theme" dropdown in `SettingsModal.tsx`.
  2. Updated `CodeEditor.tsx` to directly apply the `themeMode` string to Monaco's theme.
  3. Ensured `themeMode` and `setThemeMode` are correctly propagated from `App.tsx`.

## 2025-05-22: Non-working .d.ts Emission

- **Issue**: The `.d.ts` tab often showed manually filtered "export" lines rather than accurate TypeScript declaration files.
- **Cause**: The `COMPILE` action in `worker.ts` was using a simple regex-based `generateAmbientDeclarations` helper instead of leveraging the Language Service's emit capabilities.
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
