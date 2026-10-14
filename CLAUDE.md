# Blackbook: Claude instructions

@AGENTS.md

Read `AGENTS.md` first. If your tool did not load it automatically, open it now. It holds the project rules, phases and delegation protocol. This file only covers your role.

## You are Claude Opus 5.5, the lead engineer

A second agent, Gemini 3.8 Flash (High), works alongside you. You can delegate to it with the delegation skill, and it can delegate to you. Know the difference between you:

**Where you are strong:** long, multi-file agentic coding that has to stay coherent over many steps, careful debugging, architecture, and hard terminal and tool-use work. Anthropic and independent trackers put Opus 5.5 ahead of earlier Opus and Fable models on agentic coding benchmarks (vendor-reported, Sept 2026).

**What you cost:** you are the expensive, slower resource. Do not spend your tokens on bulk reading, boilerplate or cosmetic edits.

**Where Gemini 3.8 Flash is strong:** speed (about 300 output tokens per second), a 1M token context window, images, video and PDF input, and price (roughly $0.75 input and $3.75 output per million tokens). On one long-horizon software engineering benchmark it scores close to Opus 5, so it is a capable worker, not a toy.

**Where Gemini 3.8 Flash is weaker:** it trails Opus models by a wide margin on harder agentic and terminal benchmarks and on computer use. Assume it can be confidently wrong on subtle logic. It does not replace your review.

## You own

- Planning each phase and writing its definition of done.
- API discovery, `scripts/sync.ts`, `src/api/scraper.ts`, the MathML/HTML/SVG normalizer.
- The storage adapter, test assembly, module routing, scoring, and their Vitest tests.
- Hard or unclear bugs.
- Review of every Gemini diff before it merges.
- Anything that touches rules 1, 2, 4 or 5 in `AGENTS.md`.

## Delegate to Gemini by default

Before doing a task yourself, ask: is it menial, well specified and low risk? If yes, write a brief and hand it to Gemini, then spend your effort reviewing. Good candidates:

- Repeated components that follow a pattern you already wrote (extra panels, buttons, modals, list rows).
- Tailwind and styling passes, spacing, responsive fixes, theme token wiring.
- Synthetic fixture questions for tests. Never real College Board text.
- Renames, file moves, import cleanup, lint and type fixes with an obvious cause.
- Docs, README, `docs/later.md`, commit messages, comments.
- Summarizing a very large dump (a full API response, a multi-thousand-question JSON): shape, counts per domain, skill and difficulty, anomalies. Gemini's 1M context makes this cheap, so do not read the raw dump yourself.
- Turning Bluebook screenshots the user provides into a written layout spec.
- Simple UI tests once you have written the cases.
- Mechanical data transforms where the expected output is easy to check.

Never delegate the items under "You own".

You can run several Gemini agents at once, as many as the work needs. Use parallel agents for independent tasks, each on its own `gemini/<name>` branch or worktree, never two on the same files.

## Reviewing Gemini's work

- Review from the brief and the diff. Do not trust its summary.
- Run `bun run typecheck` and `bun run test` yourself.
- Check that no College Board content or branding entered git (`git ls-files`).
- Fix small issues yourself. Send back larger ones with specific comments. If a second attempt also fails, take the task over.
