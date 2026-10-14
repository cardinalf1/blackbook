# Blackbook

Blackbook is a free, open-source, independent Digital SAT practice tool, not affiliated with or endorsed by any testing organization.

## Status

In development. Drill mode works (pick skills, answer, see explanations, track per-skill accuracy). The exam shell, module flow, score estimates and analytics are not built yet. There is no packaged app yet; for now it runs from source.

## Setup (developers)

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start everything (the local Blackbook server and the UI):
   ```bash
   bun run dev
   ```
   It prints a link like `http://localhost:3000/?token=...` and opens it. The link works once per start.

3. In the app, press **Download questions**. Your computer downloads the questions itself and stores them in `data/app/` (git-ignored). Nothing is uploaded anywhere.

   Alternative: `bun run sync` writes `data/question_bank.json`, which you can import from the app's home screen.

While `bun run dev` runs, type `k` + Enter to stop the local server (to test lost-connection handling) and `s` + Enter to start it again.

## Commands

- `bun run typecheck` — Typecheck codebase with TypeScript compiler
- `bun run test` — Run unit and integration tests with Vitest
- `bun run sync` — Download the question bank from the terminal into `data/question_bank.json`
- `bun run server` — Run only the local server

## Content Note

This repository contains no test content. The `data/` directory is git-ignored, and all tests run exclusively on synthetic fixtures.
