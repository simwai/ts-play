<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Refactor Plan

## PR 1 — Crash fixes
- [x] src/main.tsx — ErrorBoundary
- [x] src/hooks/useLocalStorage.ts — Result.fromThrowable
- [x] src/lib/webcontainer.ts — runCommand shape fix

## PR 2 — XState compiler machine
- [x] src/lib/machines/compilerMachine.ts — create
- [x] src/hooks/useCompilerManager.ts — rewrite

## PR 3 — XState package machine + queue hardening
- [x] src/lib/machines/packageMachine.ts — create
- [x] src/hooks/usePackageManager.ts — rewrite

## PR 4 — neverthrow on service boundaries
- [x] src/lib/webcontainer.ts — ResultAsync on all public methods
- [x] src/lib/workerClient.ts — ResultAsync wrapping
- [x] src/lib/shareCodec.ts — typed decode

## PR 5 — Monaco fixes
- [x] src/components/CodeEditor.tsx — merge listeners, debounce, lib diff guard

## PR 6 — Polish
- [x] index.html — dark mode inline script
- [x] src/App.tsx — cleanup
