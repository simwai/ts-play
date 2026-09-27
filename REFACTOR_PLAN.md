# REFACTOR_PLAN.md

> Tasks sized at ~400 LOC of touched code per PATCH cycle. Order = dependencies first, highest confidence first. Each task references the `Will change` ids from the approved plan.

---

## Task 0 — Shared Helpers & Bug Fixes (~350 LOC)

**Target files:** `src/lib/errors.ts` (new), `src/lib/clipboard.ts` (new), `src/lib/sizeClasses.ts` (new), `src/App.tsx` (fixes)
**Depends on:** none
**Will-change ids:** `extract-shared-error-helper`, `extract-clipboard-fallback`, `deduplicate-size-classes`, `fix-header-status-mapping`, `cleanup-timeouts`

### Scope

- Create `src/lib/errors.ts` with `toErrorMessage(error: unknown): string`
- Create `src/lib/clipboard.ts` with `writeTextWithFallback(text: string): Promise<void>`
- Create `src/lib/sizeClasses.ts` exporting `sizeClasses` map
- Fix `headerCompilerStatus` in `App.tsx:492-497`
- Add `useRef` + cleanup effect for clipboard/share/format timeouts in `App.tsx`
- Replace all `console.error/warn` in edited code with `toErrorMessage` or toast

### Verification

```bash
rg "toErrorMessage\(" src/
rg "writeTextWithFallback" src/
rg "sizeClasses" src/lib/sizeClasses.ts
rg "headerCompilerStatus" src/App.tsx
rg "setTimeout.*setCopied" src/App.tsx
rg "console\.(error|warn)" src/App.tsx src/lib/worker.ts src/lib/workerClient.ts src/lib/webcontainer.ts src/hooks/usePackageManager.ts src/hooks/useCompilerManager.ts
```

---

## Task 1 — Worker Split (~400 LOC)

**Target files:** `src/lib/virtualFs.ts` (new), `src/lib/languageService.ts` (new), `src/lib/monacoProtocol.ts` (new), `src/lib/worker.ts` (rewrite)
**Depends on:** Task 0 (uses `toErrorMessage`)
**Will-change ids:** `split-worker`, `normalize-virtual-paths`

### Scope

- Extract path normalization & virtual FS helpers → `virtualFs.ts`
  - `normalizePath`, `isKnownSourceFile`, `readVirtualFile`, `readVirtualDirectory`, `getScriptFileNames`, `scriptVersionFor`, `snapshotFor`, `createConfigHost`
- Extract TypeScript language service setup → `languageService.ts`
  - `initializeLanguageService`, `getErrorMessage` (now from `errors.ts`), `generateAmbientDeclarations`
- Extract Monaco method handlers → `monacoProtocol.ts`
  - `handleMonacoMethod` + all `case` branches
- Rewrite `worker.ts` as thin router: import helpers, keep `globalThis.onmessage`, `ensureInitialized`, `handleCustomMessage`
- Replace duplicated path logic in `webcontainer.ts` with `virtualFs.normalizePath`

### Verification

```bash
rg "globalThis.onmessage" src/lib/worker.ts
rg "virtualFs|languageService|monacoProtocol" src/lib/
rg "normalizePath\(" src/lib/worker.ts src/lib/webcontainer.ts
```

---

## Task 2 — App.tsx: Share & Clipboard Hooks (~400 LOC)

**Target files:** `src/hooks/useShareFlow.ts` (new), `src/hooks/useClipboardActions.ts` (new), `src/App.tsx` (partial)
**Depends on:** Task 0 (uses `writeTextWithFallback`, `toErrorMessage`)
**Will-change ids:** `split-app` (partial), `extract-share-url-builder`, `improve-naming` (partial)

### Scope

- Extract `handleShare` logic → `useShareFlow.ts` returning `{ handleShare, sharing, shareSuccess }`
- Extract `handleCopyAll` + `handleDeleteAll` → `useClipboardActions.ts` returning `{ handleCopyAll, handleDeleteAll, copied }`
- Move URL builders → `src/lib/shareUrl.ts` (`buildShareServerUrl`, `buildEmbeddedShareUrl`, `loadSharedSnippetUrl`)
- Rename `doRun` → `handleRun` in `App.tsx`
- Update `App.tsx` to use new hooks and `shareUrl` helpers

### Verification

```bash
rg "useShareFlow|useClipboardActions" src/
rg "buildShareServerUrl|buildEmbeddedShareUrl|loadSharedSnippetUrl" src/
rg "handleRun\(" src/App.tsx
```

---

## Task 3 — App.tsx: Keyboard, WebContainer, Bottom Panel (~400 LOC)

**Target files:** `src/hooks/useKeyboardShortcuts.ts` (new), `src/hooks/useWebContainerBoot.ts` (new), `src/components/BottomPanel.tsx` (new), `src/App.tsx` (partial)
**Depends on:** Task 0, Task 2
**Will-change ids:** `split-app` (partial), `decouple-god-file` (partial)

### Scope

- Extract keyboard shortcut effect → `useKeyboardShortcuts.ts`
- Extract WebContainer boot effect → `useWebContainerBoot.ts`
- Extract bottom panel JSX (`Console` + `Problems` + `PackageManager` + resize divider) → `BottomPanel.tsx`
- Update `App.tsx` to use new hooks and `BottomPanel`

### Verification

```bash
rg "useKeyboardShortcuts|useWebContainerBoot" src/
rg "BottomPanel" src/
rg "swipeRef|onTouchStart|onTouchMove|onTouchEnd" src/App.tsx
```

---

## Task 4 — App.tsx: Toolbar Component (~350 LOC)

**Target files:** `src/components/Toolbar.tsx` (new), `src/App.tsx` (final)
**Depends on:** Task 2, Task 3
**Will-change ids:** `decouple-god-file` (complete), `split-app` (complete)

### Scope

- Extract header action buttons (copy, delete, format, run/stop, share, theme toggle) → `Toolbar.tsx`
- Extract tab strip (`TABS` map) → `Toolbar.tsx` or keep in `App.tsx` (whichever keeps JSX order)
- Update `App.tsx` to render `<Toolbar ... />` with same props
- Ensure `App.tsx` drops below 300 LOC

### Verification

```bash
rg "Toolbar" src/
wc -l src/App.tsx
```

---

## Task 5 — Package Manager & WebContainer Cleanup (~400 LOC)

**Target files:** `src/lib/packageDiff.ts` (new), `src/hooks/usePackageManager.ts` (rewrite), `src/lib/webcontainer.ts` (partial), `src/lib/webcontainer.ts` (rename constants)
**Depends on:** Task 1 (uses `virtualFs`)
**Will-change ids:** `extract-package-diff-logic`, `improve-naming-constants`, `remove-log-output-calls` (remaining)

### Scope

- Extract `computePackageDiff(current, previous, systemDeps)` → `packageDiff.ts`
- Rewrite `usePackageManager.ts` to use `computePackageDiff` and `toErrorMessage`
- Rename `SYSTEM_DEPS` → `WEB_CONTAINER_SYSTEM_DEPENDENCIES` in `webcontainer.ts`
- Rename `BUILTIN_MODULES` → `NODE_BUILTIN_MODULES` in `usePackageManager.ts`
- Replace remaining `console.error/warn` in `webcontainer.ts`, `usePackageManager.ts`, `useCompilerManager.ts` with `toErrorMessage` or toast

### Verification

```bash
rg "computePackageDiff" src/
rg "NODE_BUILTIN_MODULES|WEB_CONTAINER_SYSTEM_DEPENDENCIES" src/
rg "console\.(error|warn)" src/lib/webcontainer.ts src/hooks/usePackageManager.ts src/hooks/useCompilerManager.ts
```

---

## Task 6 — Naming & Comment Cleanup (~300 LOC)

**Target files:** `src/lib/worker.ts`, `src/hooks/usePackageManager.ts`, `src/App.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/IconButton.tsx`, `src/utils/cn.ts`
**Depends on:** Task 1, Task 4, Task 5
**Will-change ids:** `improve-naming` (remaining), `remove-useless-comments`, `improve-naming-constants` (remaining)

### Scope

- Apply remaining renames: `ataRef` → `typeAcquisitionRef`, `bootPromise` → `webContainerBootPromise`
- Remove redundant comments in `worker.ts:45-46`, `usePackageManager.ts:121-122`, `usePackageManager.ts:153-155`, and any JSX-restating comments in `App.tsx`
- Verify `Button.tsx` and `IconButton.tsx` import `sizeClasses` from `src/lib/sizeClasses.ts`

### Verification

```bash
rg "typeAcquisitionRef|webContainerBootPromise" src/
rg "// (increment|set user to null|Create a promise)" src/
rg "import.*sizeClasses" src/components/ui/Button.tsx src/components/ui/IconButton.tsx
```

---

## Task 7 — Type Safety for Worker Args (Optional, Medium Confidence)

**Target files:** `src/lib/workerProtocol.ts` (new), `src/lib/worker.ts`, `src/lib/workerClient.ts`
**Depends on:** Task 1
**Will-change ids:** `type-safety-worker-args`

### Scope

- Define discriminated union `MonacoRequestPayload` for Monaco method args
- Update `handleMonacoMethod` and `workerClient.send` to use typed payloads
- No runtime behavior change; compile-time safety only

### Verification

```bash
rg "MonacoRequestPayload" src/lib/
npx tsc --noEmit
```

---

## Task 8 — Final Verification & Test Pass

**Target files:** all
**Depends on:** Tasks 0-7
**Will-change ids:** all

### Scope

- Run full lint: `npm run lint`
- Run typecheck: `npx tsc --noEmit`
- Run tests: `npm test`
- Run Playwright smoke (if web app entry exists)
- Verify no `console.error/warn` remain in edited files
- Verify `App.tsx` < 400 LOC, `worker.ts` < 300 LOC

### Verification

```bash
npm run lint
npx tsc --noEmit
npm test
wc -l src/App.tsx src/lib/worker.ts
```

---

## Execution Order Summary

| Phase | Tasks    | Approx LOC Touched | Notes                                     |
| ----- | -------- | ------------------ | ----------------------------------------- |
| 1     | Task 0   | ~350               | No deps, pure helpers + bug fixes         |
| 2     | Task 1   | ~400               | Worker split, independent of App          |
| 3     | Task 2   | ~400               | Share/clipboard hooks, uses Task 0        |
| 4     | Task 3   | ~400               | Keyboard/boot/bottom panel, uses Task 0,2 |
| 5     | Task 4   | ~350               | Toolbar, completes App split              |
| 6     | Task 5   | ~400               | Package diff + WebContainer, uses Task 1  |
| 7     | Task 6   | ~300               | Naming/comments, cleanup                  |
| 8     | Task 7\* | ~200               | Optional type safety                      |
| 9     | Task 8   | —                  | Full verification gate                    |

\*Task 7 is optional; run if typecheck passes cleanly after Task 6.

---

## Conformance Checklist (per PATCH)

- [ ] All `Must use` dependencies called in patch
- [ ] No `Must not duplicate` patterns appear
- [ ] All `Must use available library` items used
- [ ] All `Must route through` modules called
- [ ] No `Must follow layer` violations
- [ ] Scope type respected: refactor rules applied
- [ ] Auto-exceptions from system_evidence honored
- [ ] No speculative code added (H25)
- [ ] No dead code added (H33)
- [ ] No magic values introduced (H34)
- [ ] No debug prints or sensitive data in logs (H36)
- [ ] No unsafe casts or `any` type used (H37)
- [ ] Per-edit lint gate passes
- [ ] Compliance audit: all PASS
- [ ] Constraint verification: all PASS
- [ ] Self-review: all TRUE
- [ ] Verification gate: all PASS
- [ ] Plan-Actual: GREEN
- [ ] Leftover audit completes
- [ ] Commit/push gate: ask → decide → execute
