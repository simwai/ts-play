# Documentation Drift Report

- **Date/Time**: 2026-09-19 05:50 UTC
- **Branch Analyzed**: `dev`

## Files Reviewed

- `README.MD`
- `docs/PROJECT_SPEC.MD`
- `docs/BUG_LOG.MD`
- `docs/DEPLOYMENT.MD`
- `docs/COLLECTED_PRINCIPLES.MD`

## Regressions Found

1. **`README.MD`**:
   - Corrupted development command syntax (`npm run d""ev`).
   - Stale package manager references (`npm install` instead of `pnpm install`).
   - Relative links with lowercase `.md` file extensions (`./docs/PROJECT_SPEC.md`, `./docs/BUG_LOG.md`) instead of absolute GitHub URLs targeting the `dev` branch with uppercase `.MD` extensions (`https://github.com/simwai/ts-play/blob/dev/docs/...`).
   - Missing links to `COLLECTED_PRINCIPLES.MD` and `DEPLOYMENT.MD`.

2. **`docs/DEPLOYMENT.MD`**:
   - Stale package manager references (`npm install` and `npm run build` instead of `pnpm install` and `pnpm run build`).

## Files Changed

- `README.MD`
- `docs/DEPLOYMENT.MD`
- `DOC_DRIFT.md`

## Fixes Made

- Fixed corrupted dev command `npm run d""ev` to `pnpm run dev` in `README.MD`.
- Replaced stale `npm install` with `pnpm install` in `README.MD` and `docs/DEPLOYMENT.MD`.
- Replaced stale `npm run build` with `pnpm run build` in `docs/DEPLOYMENT.MD`.
- Updated all documentation links in `README.MD` to absolute GitHub URLs referencing the `dev` branch with correct uppercase `.MD` extensions.
- Added links for `COLLECTED_PRINCIPLES.MD` and `DEPLOYMENT.MD` to `README.MD`.
