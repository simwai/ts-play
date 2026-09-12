# Documentation Drift Report

- **Date/Time**: 2025-05-24 12:00:00 UTC
- **Branch Analyzed**: `dev`
- **Files Reviewed**:
  - `README.MD`
  - `DEPLOYMENT.md`
  - `docs/PROJECT_SPEC.MD`
  - `docs/BUG_LOG.MD`
  - `docs/COLLECTED_PRINCIPLES.MD`

## Regressions Found

1. **`README.MD`**:
   - Outdated links targeting `https://github.com/simwai/ts-play/blob/main/...` instead of the `dev` branch as specified in project memory.
   - Development commands referenced `npm` (`npm install`, `npm run dev`) instead of project default `pnpm` (`pnpm@11.8.0`).

2. **`DEPLOYMENT.md`**:
   - Build and installation instructions listed `npm` first rather than prioritizing `pnpm` (`pnpm@11.8.0`).

## Files Changed

- `README.MD`
- `DEPLOYMENT.md`
- `DOC_DRIFT.md`

## Summary of Fixes Made

- Updated documentation links in `README.MD` to target the `dev` branch.
- Replaced `npm` commands with `pnpm` in `README.MD` development section.
- Updated prerequisites and build instructions in `DEPLOYMENT.md` to prioritize `pnpm`.
