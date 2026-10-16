# Run ledger

Read this and `git log` first when resuming. Do not restart a phase.

- Phases 2c to 8: DONE (tags up to `phase8-done`).
- Phase 9 (test room): DONE, tag `phase9-done` on branch `claude/phase9-test-room`. Morning report at the top of handoff/RUN-REPORT.md. Gemini branches `gemini/reference-figures`, `gemini/calc-spr`, `gemini/room-shell`, `gemini/highlights-reader` are merged.
- Phase 9 follow-up: DONE (not tagged), same branch. Desmos with each user's own key (Settings), key leak test, safety copy before deletes, typed DELETE confirm. Report in handoff/RUN-REPORT.md.
- Phase 9 picture sizing and figure controls fix: DONE. Nested question images (charts/passages in 61 older bank items) now get dedicated `FigureFrame` slots with full zoom controls (100%–200%, Reset, Full-screen modal) and responsive readable sizing (`width: 100%; max-width: 34rem`). Highlight/annotation text offsets exclude toolbar chrome.
- OPEN for the owner: `data/app/user.db` was found empty (0 sessions, 0 events; last written 11:43 to 11:45 on 2026-10-16, before the Phase 9 session). The 05:15 daily backup is intact; restoring it is the owner's decision.
- Next: owner testing of the test room; bug list in handoff/BUGS.md.
