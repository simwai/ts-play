<!-- AGENT PROMPT: Please update this file after every message if it is relevant. Continuous updates ensure that the documentation accurately reflects the current state of the codebase, project specification, and architectural principles. -->

# Stability & State Management Refactor Plan

This document outlines the final phase of the stability refactor, focusing on unified state management and coordination.

## Problem Statement
The current codebase uses a mix of `useLocalStorage`, a custom `PlaygroundStore` (Event-Emitter style), and scattered local states. This leads to:
1.  **Redundant Re-renders:** Root components re-render on any small state change.
2.  **Coordination Complexity:** Syncing XState machines with UI state is manually handled.
3.  **Race Conditions:** Multiple sources of truth for the same information (e.g., `tsCode` in `App.tsx` vs `PlaygroundStore`).

## The Solution: The "Pragmatic Combination"
We implemented the combination recommended in the research:
- **XState:** Manages the operational lifecycles of compilation and package management.
- **Jotai:** Centralizes reactive UI state and persistence with `atomWithStorage`, minimizing root-level re-renders.
- **neverthrow:** Provides typed error handling for all asynchronous boundaries.

## Refactor Steps

### 1. Global State Migration (Jotai)
- [x] Install `jotai`.
- [x] Create `src/lib/store.ts` to define persistent and operational atoms.
- [x] Implement sequential task queue as a Jotai action (`enqueueTaskAtom`).

### 2. Component Refactor
- [x] Update `App.tsx` to use `useAtom` for all state interactions.
- [x] Remove `PlaygroundStore.ts` and `useLocalStorage.ts`.
- [x] Refactor `useCompilerManager` and `usePackageManager` to sync with Jotai atoms.

### 3. Stability Hardening
- [x] Implement global "Reset Workspace" Jotai action.
- [x] Update test suite to support Jotai `Provider`.

## Verification
- [x] Full E2E "Happy Path" test pass.
- [x] Frontend verification via Playwright screenshots.
- [x] Memory leak check and manual storage persistence check.
