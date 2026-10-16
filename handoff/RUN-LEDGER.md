# Run ledger

Read this and `git log` first when resuming. Do not restart a phase.

- Phases 2c to 8: DONE (tags up to `phase8-done`).
- Phase 9 (test room): DONE, tag `phase9-done` on branch `claude/phase9-test-room`. Morning report at the top of handoff/RUN-REPORT.md. Gemini branches `gemini/reference-figures`, `gemini/calc-spr`, `gemini/room-shell`, `gemini/highlights-reader` are merged.
- Phase 9 follow-up: DONE (not tagged), same branch. Desmos with each user's own key (Settings), key leak test, safety copy before deletes, typed DELETE confirm. Report in handoff/RUN-REPORT.md.
- Phase 9 picture sizing and figure controls fix: DONE. Nested question images (charts/passages in 61 older bank items) now get dedicated `FigureFrame` slots with full zoom controls (100%–200%, Reset, Full-screen modal) and responsive readable sizing (`width: 100%; max-width: 34rem`). Highlight/annotation text offsets exclude toolbar chrome.
- Phase 10 (desktop release): COMPLETED on `claude/phase10-release`.
  - **Commit Log**:
    - `4eee587`: feat(server): desktop-ready local program (control line, static page, start and exit rules) (Step 1)
    - `263991f`: feat(desktop): Electron shell with sidecar, two-stage download and bank backup zip (Step 1)
    - `1cbb7f3`: feat(scripts): bank-zip export and round-trip verify from the command line (refuses the repo) (Step 1)
    - `2ebd73c`: feat(types): contracts for the Phase 10 screens (welcome, while you wait, bank backup, help, about) (Step 4)
    - `df513d7`: feat(desktop): persisted preferences and exit flush coordination (Step 2)
    - `541e6c1`: feat(hardening): network egress audit, license inventory, and crash boundary (Step 3)
    - `123f9ab`: feat(ui): first-run welcome, backup panel, help, about, and guides (Steps 5 & 6)
    - `ca81a54`: feat(build): release packaging script for sidecar and electron installer (Step 7)
    - `82e2a11`: chore: hygiene, legal docs, gitignore tests, and CI workflows (Steps 8 & 9)
    - `d2d47e0`: feat(release): prepush audit script and release audit gates (Step 10)
    - `b57309f`: chore(gitignore): ignore local phaseexec prompt files
  - **Artifacts**:
    - Windows Installer built: `release/Blackbook-Setup-1.0.0.exe` (158 MB)
    - Checksum: `release/SHA256SUMS.txt` (`b3c1a093869a47f40c682425749183432095a52b093fd6e34d63798dcbdac89a`)
    - Question Bank Backup Zip verified: `%USERPROFILE%\Documents\Blackbook Backups\Blackbook-QuestionBank-2026-10-16.zip`
  - **Pre-Push Audit**:
    - All 6 checks PASSED (zero sensitive files, zero keys, zero content in repo, tsc clean, 139 test files / 992 tests passing, installer & checksum verified).
  - **Release Gate**:
    - `gh` CLI is not installed on this machine. Stopped cleanly before pushing per Phase 10 rules. Push and release instructions detailed in `handoff/RUN-REPORT.md`.
