# Phase 10: Desktop App, Backup Zip, Docs and Public Release (2026-10-16)

**Branch:** `claude/phase10-release`  
**Status:** ALL 10 STEPS COMPLETED. Pre-push audit 100% green. Gate hold before git push (gh CLI not installed).

---

## 1. Executive Summary & Verification Gates

Phase 10 transforms Blackbook into a self-contained, fully offline desktop application with native Electron packaging, an external question bank backup utility, first-run onboarding, comprehensive user guides, and legal compliance.

### Pre-Push Release Audit Results (`bun scripts/prepush-audit.ts`):
- **Gate 1: Sensitive File Check:** PASSED. No local data (`.sqlite`, `.db`), archives (`.zip`), or private folders tracked by git.
- **Gate 2: Hygiene & Secret Scrubbing:** PASSED. No developer username, local user profile paths, personal emails, or live API keys in tracked files.
- **Gate 3: Zero Source Content:** PASSED. No official question text, passages, or proprietary figures tracked anywhere in the repository.
- **Gate 4: TypeScript Compiler:** PASSED (`tsc --noEmit` exited 0 with no errors).
- **Gate 5: Vitest Test Suite:** PASSED. **139 test files, 992 tests executed, ALL 992 PASSED** in ~55s.
- **Gate 6: Release Packaging & Checksum:** PASSED. Standalone installer verified against SHA-256 manifest.

---

## 2. Release Artifacts & External Backups

1. **Windows Desktop Installer:**
   - **File:** `release/Blackbook-Setup-1.0.0.exe` (158 MB)
   - **Checksum (SHA-256):** `b3c1a093869a47f40c682425749183432095a52b093fd6e34d63798dcbdac89a`
   - **Checksum Manifest:** `release/SHA256SUMS.txt`
   - **Features:** Self-contained NSIS installer bundling the Electron shell, React frontend, and pre-compiled Bun sidecar binary. Fully offline runtime with automatic local port negotiation and clean process teardown.

2. **External Question Bank Backup Zip:**
   - **File:** `%USERPROFILE%\Documents\Blackbook Backups\Blackbook-QuestionBank-2026-10-16.zip` (104.9 MB)
   - **Contents:** 4,374 questions, full figure assets, and schema manifest (`schema_version: 1`).
   - **Safety:** Created completely outside the repository tree; verified with round-trip CLI (`bun scripts/bank-zip.ts verify`) and automated unit tests.

---

## 3. What Was Built (Steps 1–10)

- **Step 1: Desktop Shell & Sidecar Integration**
  - Robust child-process lifecycle manager (`electron/core/sidecar.ts`, `server/control.ts`) with `/healthz` polling, cookie token handshake, and stdin close exit triggers.
  - Two-stage bank download architecture allowing students to start drills immediately while background ingestion completes.
  - Headless command-line zip verification and backup tooling (`scripts/bank-zip.ts`).
- **Step 2: Preference Persistence & Save-on-Exit**
  - Atomic JSON preferences store (`server/preferences.ts`, `src/types/preferences.ts`, `/api/preferences`) preserving drill setups, browse filters, and test room zoom/tool states across restarts.
  - Flush hooks on window unload and SIGINT/SIGTERM preventing loss of in-flight session data.
- **Step 3: Network Lockdown, Licenses & Crash Boundaries**
  - Network egress audit document (`docs/network.md`) and automated regression test (`server/network.test.ts`) guaranteeing zero unauthorized outbound requests.
  - `THIRD_PARTY_LICENSES.md` inventorying all dependencies and licenses.
  - React Error Boundary UI (`src/components/common/ErrorBoundary.tsx`) providing one-click diagnostic log copy without leaking sensitive data.
- **Step 4, 5 & 6: Release UI Screens & User Guides**
  - `WelcomeScreen`: First-run landing experience with 3 clean setup pathways.
  - `WhileYouWaitPanel`: Real-time download progress showing staged readiness.
  - `BankBackupPanel`: Import/export question bank zip utility wired into `BankScreen`.
  - `HelpScreen` & `AboutScreen`: System diagnostics, storage paths, and in-app open-source license viewer.
  - User documentation in `docs/guides/`: `INSTALL-WINDOWS.md`, `INSTALL-MAC.md`, `GET-A-GROQ-KEY.md`, `GET-A-DESMOS-KEY.md`, `TROUBLESHOOTING.md`, and `FRIEND-CHECKLIST.md`.
  - Comprehensive `README.md` reflecting 1.0.0 offline capabilities.
- **Step 7: Packaging Orchestration**
  - End-to-end release pipeline script (`scripts/build-release.ts`) compiling the Bun sidecar binary, building the Vite production bundle, and packaging the NSIS installer via electron-builder.
- **Step 8 & 9: Legal, Hygiene & CI Workflows**
  - MIT `LICENSE`, trademark disclaimer `NOTICE`, security disclosure `SECURITY.md`, and fair use legal notes `docs/legal-notes.md`.
  - GitHub Actions CI workflows for test suite execution (`.github/workflows/test.yml`) and automated release asset publishing (`.github/workflows/release.yml`).
  - Automated hygiene tests (`scripts/gitignore.test.ts`, `scripts/scrub.test.ts`).
- **Step 10: Pre-Push Audit & Gate Verification**
  - Pre-push automated audit script (`scripts/prepush-audit.ts`) enforcing all 6 compliance and test gates before release publication.

---

## 4. Phase 10 Commit Log

```
f2496e4 chore(hygiene): sanitize emails and genericize ledger paths
b57309f chore(gitignore): ignore local phaseexec prompt files
d2d47e0 feat(release): prepush audit script and release audit gates (Step 10)
82e2a11 chore: hygiene, legal docs, gitignore tests, and CI workflows (Steps 8 & 9)
ca81a54 feat(build): release packaging script for sidecar and electron installer (Step 7)
123f9ab feat(ui): first-run welcome, backup panel, help, about, and guides (Steps 5 & 6)
541e6c1 feat(hardening): network egress audit, license inventory, and crash boundary (Step 3)
df513d7 feat(desktop): persisted preferences and exit flush coordination (Step 2)
2ebd73c feat(types): contracts for the Phase 10 screens (welcome, while you wait, bank backup, help, about)
1cbb7f3 feat(scripts): bank-zip export and round-trip verify from the command line (refuses the repo)
263991f feat(desktop): Electron shell with sidecar, two-stage download and bank backup zip
4eee587 feat(server): desktop-ready local program (control line, static page, start and exit rules)
```

---

## 5. Manual Push & GitHub Release Instructions

> **Note on Gate Hold:**
> Under Step 10 rules, the agent checks for GitHub CLI availability (`gh --version`). Because `gh` is not installed on this machine, execution stopped cleanly at the release gate without pushing to `origin`.
> 
> Run the following commands in your shell to push the release and publish it:

### Step A: Push to GitHub
```bash
# Verify you are on the release branch and working tree is clean
git status

# Push the release branch to remote
git push origin claude/phase10-release

# Fast-forward main to the release branch
git checkout main
git merge claude/phase10-release --ff-only
git push origin main

# Create and push the release tag
git tag -a v1.0.0 -m "Blackbook v1.0.0 public release"
git push origin v1.0.0
```

### Step B: Publish the GitHub Release
**Option 1: Via GitHub Web Interface (Recommended)**
1. Navigate to: `https://github.com/cardinalf1/blackbook/releases/new`
2. **Choose a tag:** Select `v1.0.0`.
3. **Release title:** `Blackbook 1.0.0`
4. **Description:** Copy and paste the contents of [CHANGELOG.md](file:///C:/Users/Raghav/.t3/projects/blackbook/CHANGELOG.md).
5. **Attach binaries:** Drag and drop the following files into the release assets dropzone:
   - `release/Blackbook-Setup-1.0.0.exe`
   - `release/SHA256SUMS.txt`
6. Click **Publish release**.

**Option 2: Via GitHub CLI (if installed later)**
```bash
gh release create v1.0.0 release/Blackbook-Setup-1.0.0.exe release/SHA256SUMS.txt \
  --title "Blackbook 1.0.0" \
  --notes-file CHANGELOG.md
```

---

# Phase 9 follow-up: Question picture sizing and figure zoom controls (2026-10-16)

Branch `claude/phase9-test-room`. Not pushed. Typecheck clean, 129 test files and 914 tests passing, `bun run sync --limit 1` exit 0.

- **Issue addressed:** "uhh the picture is very small" in test room and drill question views.
  - Root cause: Top-level `<figure>` elements (holding `<svg>` or `<img>`) previously received `FigureFrame` zoom controls via `splitFigures`, but 61 questions in the bank (51 stimulus, 10 stem) contain nested `<img>` tags (e.g. inside `<div class="standalone_image">` or `<div class="passage">`).
  - These nested images rendered without zoom or full-screen controls at their natural small pixel size (often 200–480px wide), uncentered and without responsive scaling.
- **Portaled Figure Frames for nested pictures:**
  - Added `extractInlineImages` in `src/services/exam/figures.ts` which identifies non-math `<img>` tags, replaces each with a placeholder slot `<span data-bb-figure="{index}" class="bb-figure-slot"></span>`, and returns the extracted image markup.
  - Added `HtmlWithInlineFigures` in `src/components/testroom/ContentHtml.tsx` which dynamically mounts a `FigureFrame` into each slot via React `createPortal`.
  - Math images (`math-img`, `bb-math-img`) are excluded and remain inline as math expressions.
- **Responsive readable sizing & full-screen modal expansion:**
  - Added CSS in `src/index.css`: `.bb-figure-slot { display: block; margin: 0.75rem 0; }` and `[data-bb-figure-frame] img:not(.math-img):not(.bb-math-img) { display: block; width: 100%; max-width: 34rem; height: auto; }`.
  - Added `[role="dialog"][aria-label="Figure, full screen"] img:not(.math-img):not(.bb-math-img) { max-width: 100%; }` to allow full expansion when viewed in the full-screen modal.
  - Set `data-bb-figure-frame` on `FigureFrame`'s outer container.
- **Highlight and annotation offset safety:**
  - Updated `countable()` in `src/services/exam/annotateDom.ts` to ignore text inside `[data-bb-figure-frame]` outside `.bb-content` text nodes, preventing zoom toolbar chrome ("100%", "Reset") from shifting Reading & Writing highlight/note character offsets.
- **Tests added:**
  - Unit tests in `src/services/exam/figures.test.ts` for `extractInlineImages`.
  - Integration tests in `src/components/testroom/ContentHtml.test.tsx` verifying inline portal framing, highlight text isolation, top-level figure framing, and math image inline preservation.

---

# Phase 9 follow-up: Desmos with your own key, and delete safeguards (2026-10-16)

Branch `claude/phase9-test-room`, after the `phase9-done` tag. Not pushed. Typecheck clean, 128 test files and 910 tests passing, `bun run sync` exit 0, no key-shaped string in any committed or handoff file.

- **Desmos calculator.** Settings now has a "Desmos calculator" section with Save key, Test and Remove key.
  - The key is stored like the Groq key: `secrets/desmos-key` in the user-data folder, never in the database, exports, backups, replies or logs.
  - With a key, the calculator panel loads Desmos (Graphing and Scientific) from its official script inside a sandboxed frame served by the local program. Desmos's script never gets the app's origin, token or data, and the app's own code never handles the key.
  - With no key, or when the script cannot load, the panel shows a plain message, and the test carries on.
  - Drag, resize, mode switch, keeping state per module and resetting it between modules, and counts-only telemetry are unchanged.
  - Details and labels: `docs/calculator-spec.md`.
- **Key leak test:** `src/services/secrets.test.ts` fails on a Desmos-shaped or Groq-shaped key in any committed file, any handoff file or an export. I checked that it fails by planting one temporarily.
- **Safety copy** before Delete all progress and Delete telemetry, like the one before a restore. If the copy cannot be written, nothing is deleted. Nothing is written when there is nothing to lose. Five safety copies are kept.
- **Delete all progress** needs the word DELETE typed before its button works.

**Checked in the browser** (on a copy of the data folder, deleted afterwards):
- The Settings section saves a key without ever showing it.
- Test against the real Desmos server says a made-up key is not recognized.
- With that key, the drill calculator created the sandboxed frame, the frame page came back 200 with its CSP, and the panel fell back to "could not load".
- After Remove, the panel shows the "no calculator is set up" message pointing to Settings.
- Delete all progress stayed disabled until DELETE was typed, and wrote `before-delete-all-*.json` first.

**Could not verify:**
- **A working calculator.** I have no real Desmos key, so I never saw Desmos draw. Still unknown:
  - whether a real key loads under the frame's CSP (eval, workers, other Desmos hosts);
  - whether Graphing opens at -10 to 10;
  - whether state survives question changes in practice;
  - what Scientific does on a key without it enabled.
- **Whether keys are limited to some websites, and whether localhost is accepted.** The docs don't say, and the key page needs a login. Settings > Test can't detect it. If Test passes but the panel says "could not load", that is the likely cause.
- **Why the made-up key failed in the frame.** The browser's console inside the frame couldn't be read, because the preview's snapshot timed out. I couldn't tell the 403 apart from a CSP block. The server-side request did get the 403.
- **The panel in an exam module.** It shares the same component and engine and is covered by tests, but I only clicked through it in a drill.

**To test with your key:** `bun run dev`, settings menu, Settings, "Desmos calculator", paste your key, Save key, Test. Then start a Math drill or module, open Calculator, switch modes, go to another question and back, and close and reopen it.

---

# Morning report: Phase 9 (test-room tools and layout; 2026-10-16, unattended)

## Read this first: your local data is empty

While checking the screens I found that `data/app/user.db` (the dev data folder) has **0 sessions and 0 events**. The Phase 8 inventory counted 719 events. The database files were last written at **11:43 and 11:45 today, before this session started**, and I did not run anything against that folder that writes to it: my browser check ran on a copy (`data/p9check`, now deleted). I don't know what emptied it.

**Your backup from 05:15 today is intact:** `data/app/backups/blackbook-2026-10-16.json`, 180 KB, holding 14 sessions, 74 attempts, 386 events and 4 flags. Anything you did after 05:15 is probably not in it. I did not restore it, because that is your call. To restore: `bun run dev`, the settings menu (top right of Home), "Your data", "Backups and restore", and restore `blackbook-2026-10-16`. Restoring first saves a "before restore" snapshot. Do it before you start the dev server on another day, because the server writes a new daily backup at its first start of the day.

## Status

**Phase 9 is done** on branch `claude/phase9-test-room`, tag `phase9-done`. Nothing is pushed.

Final gates:
- Typecheck clean, 124 test files and 893 tests passing.
- `bun run sync` exit 0.
- Nothing from `data/`, `fixtures/`, `docs/research/` or `handoff/screens/` is tracked, and no PNG at all.

The test count went from 801 to 893: about 130 new tests, minus 39 UI tests of the seven Phase 3 screen parts the test room replaced (removed). The timer, routing and persistence tests from Phases 3 and 4 are unchanged and pass.

`handoff/BUGS.md` was empty, so there were no bugs to fix.

**What I wrote:**
- SPR grading, limits and preview parsing.
- The contracts, the tool store and the telemetry events.
- Highlight storage, overlap rules and DOM marks.
- Figure splitting.
- The test-room composition wired to the exam state machine, and the drill tools.
- The calculator terms check, every doc, and the tests for all of it.

**What Gemini 3.8 Flash built:** the UI spec from your screenshots (High effort) and the presentational parts. Four writers ran at Medium effort in worktrees, never more than three at once:
1. Header, footer, question menu, review screen, split panes, question bar, eliminator in the choice list.
2. Reference panel and figure zoom.
3. Calculator panel, answer box and preview, response directions.
4. Highlight toolbar, note editor, line reader.

I reviewed every diff and merged them one at a time, running the tests after each.

**Fixes after review:**
- A zoomed figure was clipped instead of scrolling.
- The 45-45-90 triangle was drawn with unequal legs.
- The calculator would have saved its state under the wrong mode.
- The docked side column ignored the expanded reference width.
- The line reader's handle covered one of its three lines.
- More had no label.
- The UI spec had errors: brand name in the title, missing rectangle formula, "no divider handle" (there is one), incomplete figure controls, quoted official headings, an invented "Answer:" label, a wrong calculator description, and the highlight toolbar and zoom indicator missing.

## Definition of done

| Item | Status |
|---|---|
| Typecheck, tests, sync, nothing tracked, nothing pushed, tag | Met |
| BUGS.md items | Not applicable: empty |
| Exam modes show the new shell | Met. Seen in the browser at 1366x768, Math and Reading and Writing |
| Full Math module with Reference, eliminator, Mark for Review, question menu, review screen, typed answer with live preview | Met. Done in the browser on a copy of your data, up to submitting |
| Calculator | **Partly met.** The panel (drag, corner resize, close, Graphing/Scientific, per-module state, telemetry) is built and seen. The **Desmos embed is not**, because the terms check failed (below) |
| Every example in the directions table is a test; limits enforced as typed | Met (`src/services/exam/sprDirections.test.ts`, data in `SPR_EXAMPLES`; also on the real screen in `TestRoom.test.tsx`) |
| Reading and Writing never shows Reference or the calculator; has Highlights and Notes, line reader, zoom | Met. Tested on screen and seen in the browser |
| Tool inventory test passes for both sections | Met: `src/config/testRoomConfig.test.ts` (the lists) and `src/components/testroom/TestRoom.test.tsx` (the rendered screen, Math multiple choice, Math typed answer, Reading and Writing) |
| Phase 3 and 4 timer, routing and persistence tests unchanged and passing | Met |
| exam-spec and calculator-spec carry verified, inferred and unverified labels; skin decision recorded | Met (`docs/exam-spec.md`, "Test room (Phase 9)"; `docs/calculator-spec.md`) |

## Decisions I made

- **Desmos is not embedded.** The API terms (v1.0, 2025-07-11) allow the free tier "solely for personal, non-commercial use". They also say "Commercial use includes any use of the API in an Application that is accessed by End Users in production", and the key must not be shared. A free package handed to classmates is not clearly allowed. The panel shows "No calculator is set up in this copy of Blackbook" and points to the spec. A `CalculatorEngine` interface (`src/services/calculator/engine.ts`) is the place to plug one in. `docs/calculator-spec.md` has the quotes and the steps: ask partnerships@desmos.com, then a per-user key in Settings, loaded in a sandboxed iframe.
- **SPR grading (inferred, labeled):** a decimal of 3 or more places that truncates or rounds a fraction in the key at its last place is accepted (`SPR_DECIMAL_MIN_PLACES` in `scoringConfig.ts`). It matches every official example and applies only against fraction forms, whose value is exact. Grading is live, so old drill reports may now show such answers as correct. Three old tests that encoded the exact-only rule were updated. `SCORING_CONFIG_VERSION` was not bumped (routing and estimates are unchanged).
- **Characters as typed:** `.`, `-` and `/` all count (the first two inferred from the examples; the slash unverified). A key press or paste past the limit is ignored.
- **The look is ours.** Behavior and layout follow the screenshots; colors, icons, figures and wording are Blackbook's own. The reference drawings are new SVGs, and the directions are in our words.
- **Footer left** shows "Math, Module 1" (no name is stored).
- **More menu:** Help (our text), Shortcuts (our keys), Line Reader (Reading and Writing only), Unscheduled Break, Emergency pause (Blackbook only, moved here from the header), and Exit (clock keeps running, moved here from the corner). Assistive Technology is not built.
- **Unscheduled break:** the module clock keeps running; the question's own active time stops.
- **Eliminator** starts off in each module and stays on across questions. Struck choices stay struck when it is turned off.
- **Calculator** state, place and mode last within a module and reset in the next. Zoom (75 to 200%, Ctrl plus, minus and 0) lasts for the app session.
- **Highlights** are stored on the session record per question (`annotations`, validated on the server: offsets, style, note of at most 1000 characters, at most 100 per question). A new highlight takes over the text it covers. Telemetry logs counts only, never the text or the note.
- **Line numbers:** not built. The bank's passages carry no line-number markup, so none were invented.
- **Figures** with a drawing or picture get zoom in and out, a percentage, Reset and full screen. Tables don't.
- **Drills** keep their screen and gain Calculator and Reference (Math), highlights and notes (Reading and Writing) and figure zoom. Their typed-answer box is unchanged.
- **Browser check on a copy:** I ran the server with `--data data/p9check` (a copy without your secrets folder), so starting test modules did not use up questions in your pool. The copy is deleted.

## What I could not see

- **Not seen in the browser:** a figure's zoom controls and full screen on a real question (unit-tested only); the Directions dropdown text; Help and Shortcuts dialogs; the five-minute alert in the new header; emergency pause from More; pointer-dragging the divider, calculator and line reader (keyboard and unit tests only); the expanded reference.
- **Not seen in your screenshots** (assumed, listed in `docs/exam-spec.md` and `docs/later.md` as screenshots to take):
  - the review page;
  - the Math More menu;
  - Help, Shortcuts and Assistive Technology contents;
  - the Directions dropdown open;
  - the line reader on screen;
  - the unscheduled break screen and the exit dialog;
  - a typed value in the Answer Preview;
  - Scientific mode;
  - figure full screen;
  - the note editor and the underline dropdown;
  - the timer hidden and the five-minute warning;
  - whether the eliminator starts on.

## Quota or tool problems

- None from Gemini; all five tasks finished on the first try.
- The T3 browser preview worked this time (Phase 8's timed out).
- The session was interrupted once during the final gates; I checked the commit had landed and reran the gates.

## Exact steps to test it yourself

1. **Restore your backup first** (top of this report), then `bun run dev`.
2. Take a test, One module, pick Math, Start the clock.
3. **Header:** Directions on the left; timer and Hide in the center; Calculator, Reference and More on the right; 100% in the corner. Press Ctrl plus and Ctrl minus (the corner changes), then Ctrl 0.
4. **Question 1 (multiple choice):** no Back. Click the crossed "ABC" at the right of the question bar: a crossed-letter button appears by each choice. Click one, then click it again to restore it. Mark for Review fills the bookmark.
5. **Reference:** opens docked on the right and squeezes the question; the expand icon widens it; X closes it.
6. **Calculator:** a floating panel with Graphing and Scientific, a grip to drag, a corner to resize and X. It says no calculator is set up (expected; see `docs/calculator-spec.md`).
7. **A typed-answer question:** directions and examples table on the left, no ABC toggle. Type `-1/3`: the preview shows a stacked fraction. Try `0.6667`: it stops at `0.666`. `%`, `,`, `$` and spaces are refused.
8. **Footer:** "Question N of 22" opens the menu (current pin, dashed unanswered, bookmark on marked) with "Go to Review Page". The review page lists every question; Submit module asks to confirm that you cannot return.
9. **More:** Unscheduled Break hides the question while the clock keeps running, and "Resume testing" brings it back. Exit leaves with the clock running.
10. **Reading and Writing module:** the header shows Highlights & Notes and More, with no Calculator or Reference. Select words in the passage and a toolbar appears: three colors, underline, note (and delete on an existing highlight). Add a note, go Next and Back, and the highlight and note are still there. More, Line Reader shows a three-line window; drag its bar or use the arrow keys; Escape closes it.
11. **Drill (Math):** Calculator and Reference buttons sit in the question header. **Drill (Reading and Writing):** select passage text to highlight it.
12. The checklist as a test: `bunx vitest run src/components/testroom/TestRoom.test.tsx src/config/testRoomConfig.test.ts`.
