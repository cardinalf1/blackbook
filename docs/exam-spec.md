# Exam module spec (Phase 3)

What the practice exam module copies from the real test, where each number comes from, and every behavior that is a guess. Every number used in code lives in `src/config/examConfig.ts`, each marked verified or assumed. Blackbook copies layout and behavior only, with no logos, names or assets (AGENTS.md rule 2).

## Sources (read 2026-10-15)

1. **Reading and Writing specifications**, SAT Suite K-12 educator alignment page. <https://satsuite.collegeboard.org/k12-educators/about/alignment/reading>
2. **Math specifications**, SAT Suite K-12 educator alignment page. <https://satsuite.collegeboard.org/k12-educators/about/alignment/math>
3. **SAT test directions** (the translated Bluebook directions, PDF). <https://satsuite.collegeboard.org/media/pdf/english-sat-test-directions-bb.pdf>
4. **Digital SAT Suite of Assessments Technical Manual** (PDF). <https://research.collegeboard.org/media/pdf/Digital%20SAT%20Suite%20of%20Assessments%20Technical%20Manual-FINAL.pdf>

## Verified

| Fact | Value | Source |
|---|---|---|
| Reading and Writing module | 27 questions (25 operational, 2 pretest), 32 minutes | 1, 3 |
| Math module | 22 questions (20 operational, 2 pretest), 35 minutes | 2, 3 |
| Reading and Writing domains, whole section | Craft and Structure ≈28%, Information and Ideas ≈26%, Standard English Conventions ≈26%, Expression of Ideas ≈20% | 1 |
| Math domains, whole section | Algebra ≈35%, Advanced Math ≈35%, Problem-Solving and Data Analysis ≈15%, Geometry and Trigonometry ≈15% | 2 |
| Math formats | Multiple choice ≈75%, student-produced response ≈25% | 4 (Table 2.3) |
| Reading and Writing order in each module | Craft and Structure, then Information and Ideas, then Standard English Conventions, then Expression of Ideas | 4 (Table 2.2) |
| Order inside a Reading and Writing domain | By skill, then easiest to hardest. Standard English Conventions: easiest to hardest whatever the skill | 4 (section 2) |
| Order inside a Math module | "Across each module, items are arranged from easiest to hardest." All four domains appear in each module | 4 |
| First module difficulty | "a broad mix of easy, medium-difficulty, and hard questions" | 4 |
| Student-produced response length | "up to 5 characters for a positive answer and up to 6 characters (including the negative sign) for a negative answer" | 3 |
| Student-produced response forms | Mixed numbers as an improper fraction or decimal; no %, comma or $ signs; decimals that do not fit are truncated or rounded at the fourth digit | 3 |
| Timer at zero | "When the timer reaches zero, you will automatically move on. Once you move on from any module, you cannot return to it." | 3 |
| Review | "If time permits, you can review your answers in a given module." | 3 |
| A reference sheet and directions are available in Math throughout the module | yes | 3 |

## Derived (from the verified numbers, by rule)

- **Domain counts per module.** The sources give whole-section percentages only. Blackbook applies them to one module, with largest-remainder rounding:
  - Reading and Writing (27): Craft and Structure 8, Information and Ideas 7, Standard English Conventions 7, Expression of Ideas 5.
  - Math (22): Algebra 8, Advanced Math 8, Problem-Solving and Data Analysis 3, Geometry and Trigonometry 3.

  The real test's per-module counts vary from form to form.
- **Student-produced responses in Math:** 25% of 22 is 5.5, rounded to 6 per module.

## Assumed (check against the real thing)

1. **No pretest questions.** All 27 or 22 questions are drawn from the bank and all count toward the raw score. The real test has 2 unscored pretest questions per module.
2. **Difficulty mix of a single module.** Equal thirds of easy, medium and hard in each domain, by largest remainder. The source only says "a broad mix".
3. **Math order.** The default is the official order (`MATH_ORDER = 'official'`): the technical manual (source 4) says Math items run easiest to hardest across the whole module, ties broken by domain. The manual does not say where student-produced responses go, so they fall wherever their difficulty puts them. An earlier Phase 3 spec asked for multiple choice first and student-produced responses in the last quarter, each block in domain order and easiest to hardest within a domain. That was wrong about the official order; it is kept as `MATH_ORDER = 'spec'`.
4. **Skill order inside a Reading and Writing domain.** The manual says items are ordered "first by skill" but not in what order. Blackbook uses the bank's skill order: Words in Context, Text Structure and Purpose, Cross-Text Connections; Central Ideas and Details, Command of Evidence, Inferences; Rhetorical Synthesis, Transitions.
5. **The timer** sits in the header and counts down in minutes and seconds, with a Hide/Show button. Hiding is a behavior of the official app as I understand it, not from these sources.
6. **The five-minute alert.** At 5:00 left the timer is shown again even if hidden, and a short dialog says five minutes remain. It is shown once per module. I am not sure the official app uses a dialog rather than an in-place message.
7. **Pause.** The directions mention a Pause under the timer, but only for students with an approved break accommodation. Blackbook's "Emergency pause" is not an official feature: it stops the clock, asks for a reason, hides the questions while paused, and permanently marks the result as paused.
8. **Review page.** The last question's Next opens a review page that lists unanswered and flagged questions, with a grid to jump back. Submitting asks for confirmation. When time runs out, it submits without the review page.
9. **Navigator.** The question counter in the bottom bar opens a grid of every question showing current, answered, unanswered and flagged, and clicking one jumps to it.
10. **Reading and Writing layout:** a 50/50 split, passage on the left, question and choices on the right, each scrolling on its own. **Math layout:** a single centered column. A question with no passage in Reading and Writing uses the right pane alone.
11. **Strike-out:** the same (x) control as drill mode. A struck choice cannot be selected.
12. **The reference sheet** lists the standard geometry formulas as plain text written for Blackbook, not a copy of any official sheet's layout or image.
13. **Student-produced response input:** only digits, `.`, `/` and `-` can be typed. `-` only as the first character. Up to 5 characters, or 6 when the first is `-`.
14. **Keyboard:** the arrow keys Left and Right act as Back and Next when focus is not in a text field.

## Full test and break (Phase 4)

- **Sequence.** Reading and Writing Module 1, Module 2, a break, then Math Module 1 and Module 2. ASSUMED to match the real app; the module lengths are verified (above), the sequence and break are not read from a source in this repo.
- **Break.** 10 minutes, counted down from a saved absolute deadline, ending by itself at zero, with no way back to a submitted module. VERIFIED in Phase 6: it cannot be ended early (see Research corrections below), so the early-end control is dev-only.
- **Module 2.** Assembled when module 1 is submitted. The easier and harder variants differ only in their difficulty mix; the mixes are assumptions (`TIER_MIX` in `src/config/scoringConfig.ts`).
- **No question twice, and nothing you have done.** See "Question pool" below (Phase 6): a question answered anywhere or shown in any exam never enters a test unless you confirm repeats.
- **Emergency pause.** Applies to each module. Using it in any module marks the whole test as paused in the results. Not an official feature (see item 7 above).
- Scoring and routing: see `docs/scoring-spec.md`.

## Research corrections (Phase 6, read 2026-10-16)

Source for this section: the research report `docs/research/digital-sat-real-mechanics.md` (kept out of git because it quotes the source site), which cites the College Board pages named below. Labels: **Verified** = stated in an official page; **Community** = from tutoring sites or blogs, unverified; **Assumed** = Blackbook's own design choice.

| Item | What the code does | Label | Source |
|---|---|---|---|
| Break cannot be started or ended early | The real exam mode has no "end break" control; the break counts down and moves on at zero. The control exists only when the dev shortened-break override is set (`isBreakShortened`). Divergence: the real app waits for a button click after the break; Blackbook continues by itself at zero. | Verified (no early end); Assumed (auto-continue) | College Board help page "How do student breaks work" |
| Reading and Writing structure | 2 modules of 27 questions (25 scored + 2 unscored pretest), 32 minutes each | Verified | Specifications Overview |
| Math structure | 2 modules of 22 questions (20 scored + 2 pretest), 35 minutes each | Verified | Specifications Overview |
| Testing time | 134 minutes plus one 10-minute break (144 with the break) | Verified | Specifications Overview |
| No pretest items in Blackbook | The bank has no pretest items, so every question in a Blackbook module is treated as scored. A Blackbook module is therefore 27 or 22 scored questions, not 25 or 20. | Assumed | |
| Routing threshold | Official text says only that the break point is "around the median" section score. The 0.5 difficulty-weighted threshold is Blackbook's own (`ROUTING_THRESHOLD`) | Assumed | |
| Easier-route cap 600, harder-route floor 400 | Official text: a full range of section scores is possible from either Module 2. The 600 and 400 are not officially sourced (the only figure found is a blog's). Numbers unchanged; labeled in `scoringConfig.ts`. The easier route's range is made wider (`EASIER_ROUTE_EXTRA_HALF_WIDTH`), and the report says the easier route "may limit the top of your range; the exact effect is not published". | Community-derived, unverified | |
| Student-produced response length | Positive: up to 5 characters. Negative: up to 6 including the minus sign. Enforced in `services/exam/spr.ts` | Verified | Test directions PDF |
| Student-produced response forms | Mixed numbers are not accepted (enter an improper fraction or decimal); no %, comma or $; one answer only (at most one "." or one "/", never both) | Verified (forms); Assumed (the exact structural limit on partial typing) | Test directions PDF |
| Do "." and "/" count toward the length limit? | They count here (so ".6667" is 5 characters and "-1/3" is 4) | **Unverified**; check in a real Bluebook practice test (listed in `later.md`) | |
| Math order | Easiest to hardest within a module; kept as `MATH_ORDER = 'official'` | Verified (the order); Assumed (where student-produced items sit, here wherever their difficulty puts them) | Technical Manual |
| Paper practice forms | The 33- and 27-question figures belong to nonadaptive paper forms, not the digital structure. Nothing in the code or docs uses them | Verified | |

## Question pool as of 2026-10-16

Live questions per section and difficulty, as `bun scripts/eligibility-check.ts --markdown` printed them. Each cell is fresh / seen-not-done / consumed. Fresh: never shown anywhere. Seen-not-done: shown in a drill or Browse but never answered. Consumed: answered anywhere, or shown in any exam module; excluded from tests unless repeats are confirmed. Rerun the script for current numbers.

| Section | Easy | Medium | Hard | All |
|---|---|---|---|---|
| Reading and Writing | 381 / 6 / 19 | 340 / 4 / 19 | 297 / 4 / 22 | 1018 / 14 / 60 |
| Math | 376 / 1 / 5 | 269 / 0 / 7 | 264 / 1 / 4 | 909 / 2 / 16 |
| Both | 757 / 7 / 24 | 609 / 4 / 26 | 561 / 5 / 26 | 1927 / 16 / 76 |

The rule is in `src/services/eligibility/eligibility.ts` and nowhere else: assembly, the preflight for Module 1 and both Module 2 variants, the pool-health estimate and the Browse markers all call it. A question in an unfinished session counts as seen, not done, until it has a final answer; a final answer in an unfinished or discarded session still counts as done. A test built with "allow repeats" is labeled "contains repeats".

## Check in real Bluebook

Not verified from any source; check each in a real Bluebook practice test and update this file:

- [ ] Review screen layout and wording (separate page? grid states for answered, unanswered, marked? submit button text).
- [ ] Student-produced answer preview (does Bluebook show a rendered preview of what was typed?).
- [ ] Break screen: what is shown, what the button says after zero, whether the countdown is visible.
- [ ] Desmos calculator behavior (not built).
- [ ] Whether "." and "/" count toward the 5- and 6-character limits.
- [ ] Where student-produced items sit inside a Math module.
- [ ] Order of skills inside a Reading and Writing domain.
- [ ] What the five-minute alert looks like.
