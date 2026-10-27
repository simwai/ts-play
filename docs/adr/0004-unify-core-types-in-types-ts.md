# 4. Unify Core Types in src/lib/types.ts

* Status: Accepted
* Date: 2026-06-20 (backfilled 2026-10-27)

## Context

Application types (such as status definitions, toast notifications, and compiler status) were duplicated across multiple components and hooks (`state-manager.ts`, `App.tsx`, `CodeEditor.tsx`), leading to type check errors and maintenance friction.

> "Unified core types (CompilerStatus, Toast, etc.) in src/lib/types.ts" (Commit 4582be5)

## Decision

Centralize all shared core domain types (`CompilerStatus`, `PackageManagerStatus`, `ToastMessage`, `ToastType`, `EnvironmentStatus`) in `src/lib/types.ts`.

> "Unified core types (CompilerStatus, Toast, etc.) in src/lib/types.ts" (Commit 4582be5)
> "Updated tsconfig.json to modern standards (moduleResolution: 'bundler')." (Commit 4582be5)

## Consequences

- Single source of truth for core data structures across components, hooks, and background worker protocols.
- Reduced `any` casts and eliminated type mismatch errors during `pnpm type-check`.

## Alternatives Considered

- No alternatives recorded in the source material.

## Related

- None

## Source

- Commit `4582be576071b45014386b06fc647d9d0af5e055` / `97626fb0a409f17d200bfb0b41cd0abd1ec72be9`: "fix: resolve all type check errors and harden functionality"
