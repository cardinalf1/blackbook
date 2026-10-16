# Session plan: Phase 8 (unattended, 2026-10-16)

Branch `claude/phase8-dashboard` from `phase7-done`. Not pushed. Screenshots (the "before") renamed to `handoff/screens/{home,browse,analytics,report}.png`, kept untracked.

0. Gate green (88 files, 692 tests, sync exit 0). `handoff/BUGS.md` is empty: nothing to fix.
1. Tokens (mine): `src/components/ui/tokens.ts` plus a few primitives (Card, Button, Label) the new screens share.
2. Hide flag (mine): migration 7 `hidden_sessions`; store, export, backup and restore; API; analytics scope and the brute checker skip hidden sessions; eligibility, retry and pool health untouched. Tests for both halves.
3. Insight fixes (mine): weakest skill only from 5+ first attempts ranked by the Study next lower bound; pool health out of insights; each insight carries an action; coach picks at most 3.
4. Dashboard contract (mine): `src/types/dashboard.ts`, scope resolution, `buildDashboard` on the existing analytics methods, `GET /api/dashboard`, HTTP adapter, up-next picker, view redirects and a reachability graph with tests. Commit interfaces.
5. Gemini, 3 writers in worktrees: (1) Home, test chooser, settings menu; (2) dashboard scope bar, coach, numbers, trends; (3) skills map, mistakes, habits, tests table, detail links. Meanwhile I wire App, Past drills hide controls and the cross-check.
6. Review and merge one at a time, full tests after each. Cross-check script on synthetic and real data, endpoint timing.
7. Screens in the browser section by section, morning report, ledger, tag `phase8-done`.
