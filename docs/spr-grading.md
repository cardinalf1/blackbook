# Student-produced response grading

Findings come from the real bank (`bun run scripts/check-spr.ts`, 2026-10-14). No question text here.

## Forms in the bank

- 394 student-produced response questions, all from the digital set. Legacy ones were skipped at sync for lack of an answer key.
- 303 questions list 1 accepted answer, 73 list 2 and 18 list 3.
- Every accepted string is a plain integer, a decimal (31 questions use a leading dot like `.5`) or an `a/b` fraction. 34 questions have negative answers. There are no mixed numbers, commas, percent signs or letters.
- Equivalent forms and rounding variants are listed explicitly, for example `.1764 | .1765 | 3/17`. No question lists only a fraction.

## Rules the grader follows (`src/services/answers.ts`)

An input is correct when, after trimming and turning a unicode minus into `-`:

1. it equals a listed string, or
2. it parses to exactly the same number as a listed string. Numbers are compared as exact fractions, never as floats.

Accepted: `0.5` for `1/2`, `2/4` for `1/2`, `0.50` for `.5`, a leading `+`.
Rejected: a rounded or truncated decimal that is not listed (`.33` for `1/3`), `5.`, `1,000`, `50%`, `2 1/2`, `1 / 2`, `1e3`, `1/0`, empty input.

## Judgement calls (not verified against the real test)

These follow the project owner's defaults, not a published rule: trailing zeros and a leading `+` are accepted; numerically equal unreduced fractions are accepted; unlisted roundings are rejected; thousands commas, a trailing dot, mixed numbers and percent signs are rejected. If the real test turns out to differ, change them in one place.
