# 3. Dedicated Problems Tab for Diagnostics

* Status: Accepted
* Date: 2026-03-31 (backfilled 2026-10-27)

## Context

TypeScript diagnostics and compiler errors were previously mixed into general console output or inline editor decorations, making it difficult for users to inspect all active project errors in one place.

> "Implement a 'Problems' tab in the bottom panel to display real-time TypeScript diagnostics." (PR #78 / Commit 58bf447)

## Decision

Add a dedicated "Problems" tab within the bottom panel component to present real-time TypeScript diagnostics with navigation support.

> "Implement a 'Problems' tab in the bottom panel to display real-time TypeScript diagnostics." (PR #78)
> "Update `Console` component to a tabbed interface (Console, Problems, Packages)." (PR #78)
> "Add 'Jump to Problem' functionality to navigate from diagnostic list to editor location." (PR #78)

## Consequences

- Users can view and navigate all TypeScript errors from a centralized panel.
- Added `useTSDiagnostics` hook integration in `App.tsx`.
- Monaco 1-indexed line and column numbers must be passed directly without extra offsets.

## Alternatives Considered

- No alternatives recorded in the source material.

## Related

- ADR-0002

## Source

- PR #78 (Commit `58bf447a5956debbbfac349340437b2aeed7a480`): "feat: add Problems tab and fix terminal output performance"
