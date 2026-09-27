# Open issues from refactoring

## Confirmed bugs (fixed in Task 0)

- `src/App.tsx:492-497` (now ~line 500) — `headerCompilerStatus` fell through `compiling` and `running` to `ready`. Fixed: explicit mapping for all `CompilerStatus` values.
- `src/App.tsx:318-337` (now ~337-350) — `setTimeout` cleanup on unmount was missing for clipboard/share/format actions. Fixed: added `useRef` + cleanup effect.
- `src/App.tsx:135`, `src/App.tsx:139` (now ~139, 145) — `workerClient` promises swallowed with `.catch(console.error)`. Fixed: route through `playgroundStore.addToast('error', toErrorMessage(err))`.

## Remaining S19/H37 log-output calls in edited code (to fix in Task 5)

- `src/lib/workerClient.ts:32-35` — `console.error('Worker execution error:', ...)`
- `src/lib/webcontainer.ts:176` — `console.warn('[WC Service] Stream read error:', message)`
- `src/hooks/usePackageManager.ts:105` — `console.error('Import detection failed:', error)`
- `src/hooks/usePackageManager.ts:162` — `console.error('ATA Error:', msg, error)`
- `src/hooks/usePackageManager.ts:248` — `console.error('Package management failed:', error)`
- `src/hooks/useCompilerManager.ts:25` — `console.error('Worker init failed:', error)`

## Architectural flaws (to address in Tasks 2-5)

- `src/App.tsx` — 676-line god file with >10 `useEffect` blocks and >8 callbacks; couples UI, worker, WebContainer, share, clipboard, and settings orchestration.
- `src/usePackageManager.ts` — 267-line hook mixes import detection, ATA delegation, npm install/uninstall queue, and UI status updates.
- `src/lib/webcontainer.ts` — boot, file ops, process spawn, and output line buffering in one service class.

## Naming improvements (partial done in Task 0, rest in Tasks 2, 5, 6)

- `src/App.tsx:394` — `doRun` → `handleRun` ✓
- `src/lib/webcontainer.ts:21` — `bootPromise` → `webContainerBootPromise` (pending)
- `src/hooks/usePackageManager.ts:79` — `ataRef` → `typeAcquisitionRef` (pending)
- `src/lib/webcontainer.ts:9` — `SYSTEM_DEPS` → `WEB_CONTAINER_SYSTEM_DEPENDENCIES` (pending)

## Duplication / DRY (partial done in Task 0 & 1, rest in Tasks 2, 5)

- Clipboard fallback block in `App.tsx:318-337` → extracted to `src/lib/clipboard.ts` ✓
- Path normalization duplicated across `worker.ts` and `webcontainer.ts` → unified behind `virtualFs.normalizePath()` ✓ (Task 1)
- `sizeClasses` map in `Button.tsx` and `IconButton.tsx` → extracted to `src/lib/sizeClasses.ts` ✓
- Error-to-string pattern in 6+ files → unified behind `toErrorMessage()` in `src/lib/errors.ts` ✓
- Share URL builders in `App.tsx` → extracted to `src/lib/shareUrl.ts` ✓

## Worker split (Task 1) ✓

- Created `src/lib/virtualFs.ts` — virtual filesystem helpers
- Created `src/lib/languageService.ts` — TypeScript language service setup
- Created `src/lib/monacoProtocol.ts` — Monaco method handlers
- Created `src/lib/customMessages.ts` — Custom message handlers
- Rewrote `src/lib/worker.ts` as thin router (~100 lines)

## Comments to remove (Task 6)

- `src/worker.ts:45-46` — comment restates ownership already clear from function names
- `src/usePackageManager.ts:121-122`, `src/usePackageManager.ts:153-155` — trivial inline comments
- `src/App.tsx` — remove any comment that only restates the next JSX line

## Type safety improvements (Task 7, optional)

- `src/worker.ts` — Replace `unknown[]` Monaco args with discriminated union `MonacoRequestPayload`
- `src/lib/workerClient.ts` — Type the `send` method payload
