# Session plan: Phase 6 (unattended, 2026-10-16)

Branch `claude/phase6-foundations` from `phase5-done`. Not pushed.

1. Step 0: gate green (typecheck, 561 tests, sync exit 0). No BUGS.md.
2. Step 1: one eligibility rule (`src/services/eligibility`), assembler/preflight/pool health on it, `examShown` in status (pure + SQL), cross-check script, tests.
3. Step 2: research corrections in config, docs and break screen.
4. Steps 3 to 5 data layer (mine): migration 5 (retry source, `mistake_tags`), retry queue derived from attempts, snapshots and restore.
5. UI by three Gemini writers in worktrees (mistake UI; retry card, pool health, Browse markers; Data page restore). I review and merge each.
6. Step 6: `scripts/analytics-inventory.ts` and `docs/analytics-inventory.md`.
7. Wire the Mistake log into Home, final gates, morning report, tag `phase6-done`.
