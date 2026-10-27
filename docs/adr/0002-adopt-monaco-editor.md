# 2. Adopt Monaco Editor

* Status: Accepted
* Date: 2026-03-20 (backfilled 2026-10-27)

## Context

The playground was utilizing a custom-built text editor component. As requirements grew for IntelliSense, automated type acquisition (ATA), hover type information, and language service diagnostics, maintaining a custom editor layer became inefficient.

> "Replace custom editor with Monaco Editor (@monaco-editor/react)." (PR #16 / Commit c859ec6)

## Decision

Adopt Monaco Editor (`@monaco-editor/react`) as the primary code editor for TypeScript and settings JSON inputs.

> "Replace custom editor with Monaco Editor (@monaco-editor/react)." (PR #16)
> "Sync ATA types with Monaco's language service defaults." (PR #16)
> "Remove redundant custom tokenizer, diagnostics, and type hooks." (PR #16)

## Consequences

- Direct access to Monaco's TypeScript language service and custom theme capabilities.
- Reduced maintenance burden by removing custom tokenizers and layout handlers.
- Increased bundle footprint due to Monaco Editor dev dependency and web worker assets.

## Alternatives Considered

- No alternatives recorded in the source material.

## Related

- None

## Source

- PR #16 (Commit `c859ec6d7278711de88bd5c7a184c5e3a1518956`): "feat: migrate to Monaco Editor and simplify codebase"
