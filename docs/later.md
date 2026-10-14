# Out-of-phase ideas

One line per idea, grouped by phase (AGENTS.md rule 8).

## Phase 1 (Ingest)
- Optional in-browser "download from the source" button (pending the user's decision, no server proxy).
- PSAT question banks (PSAT 8/9, PSAT 10, PSAT/NMSQT).

## Phase 2 (Drill mode)
- Filter drill sets by question format (MCQ vs. SPR) and active status.
- Bookmarking and tagging questions for targeted review.

## Phase 3 (Exam shell)
- Desmos calculator integration in the exam header for Math sections.
- Exam UI question navigator matrix showing answered, unanswered, and flagged items.
- Answer choice eliminator tool to cross out options.
- Split-pane layout with independent scrolling and resizable divider for stimulus passages.
- Question flag toggle and 5-minute remaining warning banner.
- Student-produced response (SPR) numeric keypad and input validation.

## Phase 4 (Module flow)
- Multi-stage adaptive test routing between easy and hard second modules based on first-module performance.
- Timed break screen between sections with countdown timer.
- Score range estimation (clearly labeled as an estimate) calculated across both sections.

## Phase 5 (Analytics & Sync)
- Supabase results sync for attempt history and per-skill accuracy (user stats only, zero question content).
- Accuracy by domain and skill with identification of weakest skills and recommended focus areas.
- Pacing analytics showing average time spent per question and difficulty tier.

## Phase 6 (Extras)
- Light theme toggle alongside the default dark theme.
- Electron desktop wrapper for offline local installation.
- Telemetry diagnostics and export of attempt logs.

## Polish (any phase)
- Importing the full bank (about 35 MB) freezes the tab for roughly 15 seconds while it sanitizes on the main thread, so the progress text cannot paint. Move import into a Web Worker or yield between chunks.
