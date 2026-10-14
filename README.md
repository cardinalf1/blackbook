# Blackbook

Blackbook is a free, open-source, independent Digital SAT practice tool, not affiliated with or endorsed by any testing organization.

## Status

Phase 1 of 6: import and view questions only. Drill, exam, scoring and analytics are not built yet.

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Download questions to your machine:
   ```bash
   bun run sync
   ```
   This writes `data/question_bank.json` to your machine from the College Board Educator Question Bank.

3. Start the local development server:
   ```bash
   bun run dev
   ```

4. Open the app in your browser and import the `data/question_bank.json` file. Questions stay stored locally on your device.

## Commands

- `bun run typecheck` — Typecheck codebase with TypeScript compiler
- `bun run test` — Run unit and integration tests with Vitest

## Content Note

This repository contains no test content. The `data/` directory is git-ignored, and all tests run exclusively on synthetic fixtures.
