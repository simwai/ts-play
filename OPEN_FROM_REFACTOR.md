# Open issues from refactoring

- **Dual State Mechanism**: The codebase maintains both `PlaygroundStore` (`src/lib/state-manager.ts`) / `useLocalStorage` and Jotai atoms (`src/lib/store.ts` references in memory/docs). Completing the transition to Jotai state will unify persistence and reduce dual-state synchronization complexity.
- **WebContainer Boot Interruption Handling**: In `src/lib/webcontainer.ts`, rapid unmounts or HMR resets in React StrictMode can interrupt WebContainer boot (`WebContainer.boot()`). The promise reset logic handles retries, but callers must handle promise rejections gracefully when instances tear down.
- **LocalStorage Quota Limits**: `src/hooks/useLocalStorage.ts` persists code snippets to `localStorage`. Large user snippets or installed package typings stored in web storage could approach browser quotas (`QuotaExceededError`).
