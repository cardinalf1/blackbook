# Run ledger

Read this and `git log` first when resuming. Do not restart a phase.

- Phases 2c to 8: DONE (tags up to `phase8-done`).
- Phase 9 (test room): DONE, tag `phase9-done` on branch `claude/phase9-test-room`. Morning report at the top of handoff/RUN-REPORT.md. Gemini branches `gemini/reference-figures`, `gemini/calc-spr`, `gemini/room-shell`, `gemini/highlights-reader` are merged.
- Phase 9 follow-up: DONE (not tagged), same branch. Desmos with each user's own key (Settings), key leak test, safety copy before deletes, typed DELETE confirm. Report in handoff/RUN-REPORT.md.
- Phase 9 picture sizing and figure controls fix: DONE. Nested question images (charts/passages in 61 older bank items) now get dedicated `FigureFrame` slots with full zoom controls (100%–200%, Reset, Full-screen modal) and responsive readable sizing (`width: 100%; max-width: 34rem`). Highlight/annotation text offsets exclude toolbar chrome.
- OPEN for the owner: `data/app/user.db` was found empty (0 sessions, 0 events; last written 11:43 to 11:45 on 2026-10-16, before the Phase 9 session). The 05:15 daily backup is intact; restoring it is the owner's decision.
- Next: owner testing of the test room; bug list in handoff/BUGS.md.
- Phase 10 (desktop release): IN PROGRESS on `claude/phase10-release` (plan in handoff/SESSION.md).
  - Step 0 gate green (916 tests, sync exit 0, BUGS.md empty). `gh` is not installed; origin is already public with only the scaffold commit.
  - 4eee587 feat(server): desktop-ready local program (control line, static page, healthz, data dir, start/exit rules, key cipher seam, log).
  - 263991f feat(desktop): Electron shell with sidecar, two-stage download and bank backup zip.
  - 1cbb7f3 feat(scripts): bank-zip export and round-trip verify from the command line (refuses the repo).
  - 2ebd73c feat(types): contracts for the Phase 10 screens (welcome, while you wait, bank backup, help, about).
  - Step 2 complete: persisted preferences (prefs.json allowlist, storage adapter, drill setup, browse filters, test room tools) and desktop exit flush hooks.
