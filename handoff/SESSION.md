# Session plan: Phase 9 (test-room tools and layout; unattended, 2026-10-16)

Branch `claude/phase9-test-room` from `phase8-done`. Not pushed. Screenshots in `handoff/screens/bluebook/` (9 images, ignored by git, never committed).

0. Gate green (107 files, 801 tests, sync exit 0). `handoff/BUGS.md` is empty: nothing to fix.
1. Gemini (High) writes `docs/bluebook-ui-spec.md` from the screenshots; I review it against the prompt's list.
2. Desmos terms check (done before coding): the free Trial Tier is "solely for personal, non-commercial use", and "commercial use includes any use of the API in an Application that is accessed by End Users in production". A package handed to classmates is not clearly allowed. So the Desmos embed is NOT built: the calculator panel shell (drag, resize, close, Graphing/Scientific switch, telemetry) is built around a `CalculatorEngine` extension point that shows a plain "not set up" message. Findings in `docs/calculator-spec.md`.
3. Mine first, committed before any worker starts: SPR value grading with the inferred tolerance, typed limits, answer preview parsing, plus tests for every example; contracts in `src/types/testRoom.ts`; tool inventory config and test; the test-room tool store; annotation types and storage on question progress (validated server-side); new telemetry event types; figure splitting and highlight range logic.
4. Gemini, 3 writers in worktrees, disjoint files: (1) header, footer, question menu, review screen, two-pane shell, More menu, zoom indicator; (2) reference panel with our own SVG figures, figure zoom frame; (3) calculator panel shell, SPR directions pane and answer preview. Then (4) highlights toolbar and line reader after one finishes.
5. Meanwhile I write `TestRoom` (the composition wired to the exam state machine) and the drill tool bar. Timers, routing, persistence and the logger stay unchanged.
6. Review and merge one branch at a time, full tests after each. Docs: exam-spec labels and skin decision, telemetry, calculator spec, analytics inventory, later.md.
7. Check the screens in a browser region by region, morning report, ledger, tag `phase9-done`.
