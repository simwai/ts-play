# Open from ADR backfill

## Run metadata

- Date: 2026-10-27
- Branch: jules-16035803413151708105-a0ba928d
- Window analyzed: 2025-10-27 to 2026-10-27 (406 commits, PRs #1 through #98)
- Candidates found: 7
- ADRs written: 4 (ADR-0001, ADR-0002, ADR-0003, ADR-0004)
- Candidates parked / skipped: 3

## WEAK — decision evident, rationale missing

*No WEAK candidates in this run.*

## REVERTED — was a decision, no longer in force

### C-03 Switch to Biome as formatter and linter
- Description: In PR #62 (Commit `452c59f` / `2aac4d3`), Biome was introduced as the project formatter and linter.
- Original decision: Adopt Biome for formatting and linting.
- Reversal: Biome was removed in subsequent refactoring commits and is no longer declared in `package.json`.
- Suggested next step: Nothing; decision is no longer in force.

## DEBATED — under active reversal

*No DEBATED candidates in this run.*

## DUPLICATE — already covered

*No DUPLICATE candidates in this run.*

## TRIVIAL / NOT-A-DECISION — skipped

### C-06 Compact Settings Modal UI layout
- Description: PR #66 (Commit `a13da89`) compacted the settings UI layout.
- Classification: TRIVIAL UI layout adjustment; a reasonable engineer would make local UI adjustments without recording architectural decisions.

### C-07 Replace console error/warn in user code with toast notifications
- Description: Commit `54d3cd8` replaced console error/warn outputs in hooks with toast notifications.
- Classification: NOT-A-DECISION; routine refactoring and code cleanup without rejected alternatives recorded.

## READY FOR NEXT RUN — STRONG beyond the per-run cap

*No excess STRONG candidates in this run.*
