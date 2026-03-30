# Complex Bug Log

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
