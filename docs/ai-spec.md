# AI layer (Phase 7)

Blackbook works fully without AI. Groq is optional and is used for two things only: choosing and ordering a weak-skill drill from a list code built, and choosing and wording a few insights from numbers code computed. Nothing on the timing or scoring path calls it: exams, timers, routing and score estimates are untouched.

## Groq, as verified on 2026-10-16

Read from Groq's documentation (console.groq.com/docs) on 2026-10-16:

| Fact | Value | Source page |
|---|---|---|
| Endpoint | `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible) | API reference |
| Auth | `Authorization: Bearer <key>` | API reference |
| Body fields used | `model`, `messages`, `temperature`, `max_completion_tokens` (`max_tokens` is deprecated), `response_format` | API reference |
| Structured output | `response_format: {type: "json_schema", json_schema: {name, strict: true, schema}}`. Strict mode needs every property in `required` and `additionalProperties: false` on every object | Structured Outputs |
| Models with strict structured output | `openai/gpt-oss-20b`, `openai/gpt-oss-120b` (also two others not used here). Blackbook uses `openai/gpt-oss-120b` (`AI_MODEL` in `src/config/aiConfig.ts`) | Structured Outputs, Models |
| Context window | 131,072 tokens for both gpt-oss models | Models |
| Rate limits (developer plan base, the page gives no separate free-tier table) | gpt-oss-20b and gpt-oss-120b: 30 requests/min, 1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day. Your own limits are on your organization's limits page | Rate limits |
| On a 429 | `retry-after` header in seconds, only on 429. `x-ratelimit-*` headers on every reply | Rate limits |

Not verified: the exact free-tier numbers for your account (check your Groq console's limits page).

## Groq's data policy for API traffic

From "Your data" (console.groq.com/docs/your-data), read 2026-10-16: "By default, Groq does not retain customer data for inference requests." Groq may temporarily log inputs and outputs while troubleshooting reliability errors or investigating suspected abuse; "these logs are retained for up to 30 days, unless legally required to retain longer." Zero Data Retention can be turned on in the Groq console's Data Controls, and then Groq does not keep data for reliability and abuse monitoring.

**Training:** that page does not say whether API data is used for training. Third-party summaries say Groq's services agreement bars training on inputs and outputs, but I could not confirm that on a Groq page, so the app says the docs page does not state it. The one-line version beside the text toggle is `GROQ_POLICY_LINE` in `src/config/aiConfig.ts`.

## Where the key lives

- You paste it on the Settings page. The browser sends it once to the local server (`PUT /api/ai/key`) and nothing ever sends it back: the status reply says only whether a key exists.
- The server writes it to `<data folder>/secrets/groq-key`, with owner-only permissions where the OS supports them (not on Windows, where it sits in your own profile folder). The data folder is `%APPDATA%\Blackbook` packaged, or the git-ignored `data/app/` in dev.
- It is not in the database, so it is not in exports, backups or restore files. It is not in events, and error messages are passed through a redaction step. Tests check the events, the export, a snapshot and the status reply for the key.
- "Remove key" deletes the file. "Test connection" sends a tiny ping request.

## What may be sent

You decided this, and the app follows it:

- **Always (metadata):** a throwaway alias per question for that request (`c01`, `c02`, ..., never the real id), domain, skill, difficulty, scoreBand, whether it was seen before, and your own statistics per skill: answers, right answers, the accuracy lower bound, your median time against the pace target, and mistake reason counts.
- **Only with "Include question text" on** (off until you accept a one-time confirmation): passage, stem and answer choices as plain text, images skipped, each cut to 600 characters. Rationales are never sent; no current feature needs them. The answer key is never sent.
- **Never:** your rules notes, your mistake notes, the key, the real question ids, or any question outside that call's candidate list.
- **Cap:** at most 60 candidates per call (`AI_MAX_CANDIDATES`), never the whole bank. The payload is also kept under about 6,000 tokens for the 8K tokens/min limit: if it is too big, the lowest-ranked candidates lose their text first.
- **Not stored:** the outgoing request is not logged, not put in events and not cached. The cache stores only replies, keyed by a SHA-256 hash of the request.
- **Preview:** "Show exactly what will be sent" returns the exact request body (minus the Authorization header) before the first call of each feature.
- **Switches:** a global "Use AI features" switch, and the text toggle. With text off, both features run on metadata only.

The AI report never sends question content at all: only insight ids, titles, headlines and numbers.

## Code decides, AI chooses and words

- **Weak-skill drill.** Code ranks your skills by the Wilson lower bound of first-attempt accuracy (at least 3 answers per skill; retries excluded), takes the 4 weakest, and builds candidates: live, not consumed for exams, never-seen first, difficulty matched to your level with one stretch step. The model returns groups of aliases. Code then maps aliases back to ids, drops unknown aliases and repeats, enforces the size, a 50% cap per skill and a 70% cap per difficulty, and fills gaps from the rule-based order. If fewer than half the drill survives from the proposal, the whole proposal is discarded and the rule-based pick runs. Session source is "weak-skill", with deferred feedback like any drill.
- **Report.** Code computes the insight menu (`src/services/ai/insights.ts`): skills below an 80% practice target, rushed misses and stuck questions, mistake reasons with the period before, last five minutes, answer changes that helped and hurt, retry progress, pool health and the overall figure. Each has facts and a sample size, and "thin data" below 20. The model picks ids and writes one sentence each. Every number in a sentence must be one of that insight's fact values, or the sentence is dropped and counted. The "next week" line gets the same check. Charts and numbers on screen come from code.
- **Labels.** Every result says "AI-assisted" or "rule-based". A fallback says why: AI off, no key, rate limit, timeout, network, an HTTP error, or a reply that broke the rules.
- **Failures.** A 20 s timeout. One retry on 429 after `retry-after` (capped at 8 s). Replies are cached per request hash, so a reload never spends a call. Each call logs an `ai_call` event with the feature, origin, candidate count, cached flag and failure kind only.

## What question text adds over metadata (not yet measured)

The plan was to compare one real run with text on against one with text off. There was no Groq key during the unattended run, so **no real run happened** and no comparison can be reported yet. What text can add, by design: the model can see which candidates test the same concept, avoid near-duplicates, and match questions to slip patterns. Metadata alone gives it only skill, difficulty and your numbers. What to try is in `docs/later.md`.

## Limits

- No AI-written explanations of questions, no bulk sending, no AI on timing or scoring (out of scope).
- The model can only reorder and group code's candidates, so a bad reply costs at most a worse order inside the rules.
