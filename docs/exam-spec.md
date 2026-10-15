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
