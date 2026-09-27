<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# ts-play Changelog

## Table of Contents

- [2026-08-29](#20260829)
- [2025-05-24](#20250524)
- [2025-05-23](#20250523)
- [2025-05-22](#20250522)

---

## 2026-08-29

### Simwai Half-Colored After Custom Font Loads

**Issue:** The "simwai" text in the settings footer appeared only half-colored once the Graffonti font loaded — the top half showed uncolored/broken glyphs while the bottom half carried the animated lit gradient.

**Cause:** Graffonti's glyph design contains horizontal scanline stripes (1–1.2px pitch at `text-xl`/20px). At 1x DPR the stripe pattern aliases against the pixel grid, producing phase-dependent coverage. No font preload caused a flash on swap.

**Fix:**

1. Added `<link rel="preload">` for the Graffonti font in `index.html`
2. Changed the span to a double-layer structure with `translate-y-[0.3px]` offset to close stripe gaps

### False "Variable Declared Twice" After Prettier Format

**Issue:** Clicking Format could make the TS editor show TS2451 "Cannot redeclare block-scoped variable" for variables that were not declared twice.

**Cause:** Monaco's default TS worker program includes both `file:///main.ts` and the generated `file:///main.d.ts` models. The `COMPILE` emit produced ambient globals that collided with `main.ts` declarations. `handleFormat` captured stale closure values.

**Fix:**

1. Appended `export {};` to generated `.d.ts` when it has no import/export, making it module-scoped
2. `handleFormat` now reads live editor values at queue-execution time instead of stale closure

---

## 2025-05-24

### Excessive NPM Installs and Missing @types

**Issue:** Rapid typing caused dozens of queued npm installs/uninstalls. @types packages were not being installed automatically in the WebContainer.

**Cause:**

1. Short debounce (1s) in import detection
2. Sequential execution of every individual import change without batching
3. No logic to check for or include @types packages

**Fix:**

1. Increased import detection debounce to 2500ms
2. Implemented target-state reconciliation loop that batches all additions and removals into single npm commands
3. Added npm registry check to verify package existence and auto-discover/install @types versions
4. Added warnings (controllable via settings) for missing packages or types

---

## 2025-05-23

### A.codePointAt is not a function (Worker Crash)

**Issue:** The application would crash with `Error: A.codePointAt is not a function` in the worker, and `t.create is not a function` in the main thread when opening settings.

**Cause:**

1. `useLocalStorage` was aggressively parsing any stored item as JSON
2. `tsConfigString` (a JSON string) was being parsed into a JavaScript object by `useLocalStorage`
3. The background worker expected a string for `UPDATE_CONFIG`, but received an object
4. `SettingsModal` was passing undefined props to `CodeEditor`

**Fix:**

1. Modified `useLocalStorage` to skip JSON parsing if the `initialValue` is a string
2. Enhanced `CodeEditor` to explicitly support `hideTypeInfo`, `disableDiagnostics`, and `disableShortcuts`
3. Implemented proper diagnostic toggling in Monaco for both TypeScript and JSON editors

---

## 2025-05-22

### Blocked Native Context Menu on Mobile

**Issue:** The browser's native context menu (for copy/paste/share) was blocked when long-pressing words in the editor on mobile devices.

**Cause:** Monaco Editor's custom hover tooltips and its internal context menu were intercepting the long-press event, even with `domReadOnly` set to true.

**Fix:**

1. Disabled Monaco's hover and context menu when `isMobileLike` is true
2. Continued to provide essential symbol information via the Type Info Bar

### Horizontal Scroll Blocked by Swipe Gesture

**Issue:** Horizontal scrolling in the code editor (when line wrap was disabled) was impossible because any horizontal swipe was intercepted by the tab-switching logic.

**Cause:** `useSwipeTabs` was listening for touches on the entire editor container without specific enough exclusion logic for interactive regions.

**Fix:**

1. Restructured `App.tsx` to place the swipe listener on the root container
2. Refined `useSwipeTabs` to only trigger tab switches when the swipe originates from the Header, StatusBar, or TypeInfoBar/Console Header
3. Excluded the Editor area from the swipe trigger

### Chrome Browser Crash (Black Screen) on "Run"

**Issue:** Clicking "Run" would occasionally cause the browser tab to crash (turning completely black) on mobile Chrome.

**Cause:** Rapid, high-volume terminal output from the WebContainer was saturating the UI thread, leading to a hang or crash.

**Fix:**

1. Implemented a yielding mechanism in `WebContainerService.spawnManaged`
2. Added a `setTimeout(resolve, 0)` yield after processing batches of output lines

### Type Info Bar "Empty Box" and Inaccurate Info

**Issue:** The Type Info Bar sometimes displayed an empty box for the "kind" tag, or failed to extract the symbol name correctly for certain TypeScript constructs.

**Cause:**

1. Brittle regex-based name extraction in `CodeEditor.tsx`
2. Missing mappings for many `ScriptElementKind` values
3. Inconsistent logic between the Worker and the Editor for name extraction

**Fix:**

1. Synchronized name extraction using `displayParts.find(p => SYMBOL_KINDS.has(p.kind))`
2. Expanded `getKindLabel` and color/style mappings to cover a wider range of TS symbol kinds
3. Added fallbacks for empty names and handled 'keyword' kind specifically

### Syntax Theme Selection Regression

**Issue:** The ability to select syntax themes was accidentally removed during a UI simplification pass. Theme changes weren't being correctly applied to the Monaco editor.

**Cause:**

1. Removal of the theme dropdown in `SettingsModal.tsx`
2. `CodeEditor.tsx` was using hardcoded logic to switch between light/dark themes, ignoring the specific selected theme

**Fix:**

1. Restored the "Syntax Theme" dropdown in `SettingsModal.tsx`
2. Updated `CodeEditor.tsx` to directly apply the `themeMode` string to Monaco's theme
3. Ensured `themeMode` and `setThemeMode` are correctly propagated from `App.tsx`

### Non-working .d.ts Emission

**Issue:** The `.d.ts` tab often showed manually filtered "export" lines rather than accurate TypeScript declaration files.

**Cause:** The `COMPILE` action in `worker.ts` was using a simple regex-based `generateAmbientDeclarations` helper instead of leveraging the Language Service's emit capabilities.

**Fix:**

1. Enabled `declaration: true` in `compilerOptions`
2. Updated the `COMPILE` message handler to call `languageService.getEmitOutput('main.ts', true)` and extract the `.d.ts` file from the output
