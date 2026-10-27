# 1. Adopt WebContainer for Client-Side Compilation and Execution

* Status: Accepted
* Date: 2026-03-21 (backfilled 2026-10-27)

## Context

The TypeScript playground required an execution environment to run user code and install npm packages. Previously, execution relied on server-side or worker execution without full Node.js runtime capabilities.

> "Migrate to completely WebContainer-based compilation and execution" (PR #27)

## Decision

Adopt StackBlitz WebContainer to execute TypeScript code and run `esbuild` natively in the browser inside a WebContainer virtual environment.

> "Updated App.tsx to sync package.json and tsconfig.json to WebContainer." (PR #27)
> "Migrated compilation to run inside the WebContainer using npx esbuild." (PR #27)

## Consequences

- Full Node.js environment available in-browser for package resolution and execution.
- Script execution is bounded by a 5-minute timeout for user code safety.
- WebContainer dependency and browser cross-origin isolation headers are required.

## Alternatives Considered

- No alternatives recorded in the source material.

## Related

- None

## Source

- PR #27 (Commit `979e5132204646a782e4e107bdc8df56507c3905` / `1258dc1f75c4da9d43da97834e7ae68b371079c8`): "Migrate to completely WebContainer-based compilation and execution"
