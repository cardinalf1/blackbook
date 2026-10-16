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

## Test room (Phase 9)

Source: the owner's 9 screenshots of a real Math and Reading and Writing practice test (2026-10-16), kept in `handoff/screens/bluebook/` and never committed. The behavioral spec written from them is `docs/bluebook-ui-spec.md`.

### The look is ours (decision)

AGENTS.md rules 1 and 2 override "make it look identical". Blackbook copies **behavior and layout structure**: where each control sits, what it does, which panes exist, what opens and closes, what is allowed when. It does **not** copy the skin: our dark monochrome tokens stay; no light blue-grey header, no dashed signature borders, no blue pill buttons, no "test preview" banner, no brand name, no copied icons or artwork. The reference sheet's figures are our own SVG drawings, and the student-produced response directions are in our own words. The formulas, rules and examples are facts and stay exact. Where a requested behavior seemed to cross that line, the safer option was taken and noted here.

### Layout (verified from the screenshots unless marked)

- Header: section and module title on the left with a Directions toggle under it; the timer in the center with Hide under it; on the right Calculator, Reference and More in Math, Highlights & Notes and More in Reading and Writing. An open tool is underlined. A small zoom percentage sits in the top right corner.
- Main area: two panes with a draggable divider. Reading and Writing: passage left, question right. Math multiple choice: no left pane, the question column alone (the calculator floats over the empty side). Math student-produced response: response directions and the examples table on the left.
- Question bar: the number in a filled square, Mark for Review with a bookmark icon, and on multiple-choice questions only the eliminator toggle at the far right (absent on student-produced responses, verified on questions 3 and 7).
- Choices: letter in a circle, the text, and a crossed-out-letter control at the right of each choice.
- Reference: docked on the right with a title bar, expand and close; opening it squeezes the question column.
- Footer: the name on the left, "Question N of M" in the center opening the question menu, Back and Next on the right; no Back on question 1; Next on the last question too.
- Question menu: title, a legend (Current, Unanswered, For Review), numbered boxes, a pin over the current one, and a "Go to Review Page" button.
- More menu (Reading and Writing, seen open): Help, Shortcuts, Assistive Technology, Line Reader, Unscheduled Break, Exit the Exam.
- Highlights toolbar (seen over a selection): three colors, an underline with a style dropdown, delete, and a note button.

### Blackbook's choices

- **Footer name:** Blackbook stores no name, so the left of the footer shows the section and module.
- **More menu:** Help (our own short text), Shortcuts (our keyboard shortcuts), Line Reader (Reading and Writing only), Unscheduled Break, Emergency pause (Blackbook only, as before) and Exit (the clock keeps running, as before). **Assistive Technology is not built** (accommodations are out of scope). The Math More menu was not seen; it has the same items minus the line reader.
- **Unscheduled break:** an overlay hides the question; the module clock keeps running (official); the question's own active time stops counting. Phase 4's scheduled break is unchanged.
- **Eliminator:** starts off in each module (ASSUMED; the screenshots show it on). Turning it off hides the per-choice controls; struck choices stay struck. A struck choice still cannot be selected (as in Phase 3).
- **Underline styles:** one underline style; the dropdown seen next to it is not built (NOT SEEN open).
- **Highlights & Notes button:** highlights the current selection in the first color; with nothing selected it says how to highlight. Selecting text opens the toolbar directly.
- **Line numbers:** not built. The bank's passages carry no line-number markup (scan of the bank, 2026-10-16: none found), so none are invented.
- **Zoom:** steps 75 to 200 percent (ASSUMED levels), Ctrl plus, Ctrl minus, Ctrl 0; kept for the app session.
- **Figures:** zoom in, zoom out, a percentage, Reset and full screen on every figure that holds a drawing or picture; tables are not framed. Zoom resets per question.
- **Review page:** layout ASSUMED (not seen): a grid of every question with its state and a Submit that warns the module cannot be reopened.

### Student-produced responses

| Item | Label | Source or reason |
|---|---|---|
| Up to 5 characters positive, 6 with a leading minus | Verified | Directions text and screenshots |
| Only one answer; no %, comma or $; mixed numbers as an improper fraction or decimal; long decimals truncated or rounded at the fourth digit | Verified | Directions text and screenshots |
| The examples table: 3.5 accepts 3.5, 3.50, 7/2 and rejects 31/2, 3 1/2; 2/3 accepts 2/3, .6666, .6667, 0.666, 0.667 and rejects 0.66, .66, 0.67, .67; -1/3 accepts -1/3, -.3333, -0.333 and rejects -.33, -0.33 | Verified | Screenshots. Every example is a test (`src/services/exam/sprDirections.test.ts`, data in `SPR_EXAMPLES`) |
| The decimal point and the minus sign count toward the limit | **Inferred** | From the examples, not stated in words: ".6666" (5) and "-.3333" (6) are listed, while "0.6667" (6) is not, for a positive answer |
| The slash counts toward the limit | **Unverified** | No example decides it; it counts here |
| Graded by value within a tolerance: a decimal of 3 or more places that truncates or rounds the exact value at its last place is accepted | **Inferred** | Matches every example (0.666 and 0.667 accepted for 2/3; 0.66 and 0.67 not). `SPR_DECIMAL_MIN_PLACES` in `src/config/scoringConfig.ts`. Applied only against fraction forms in the answer key, whose value is exact |
| A key press past the limit is ignored; a pasted value over the limit is ignored whole | **Unverified** | Assumed |
| Answer preview: a typed a/b shows as a stacked fraction, anything else as typed | **Assumed** | The screenshots show the "Answer Preview" label only, never a typed value |

## Check in real Bluebook

Ticked items were verified from the owner's screenshots (2026-10-16). Open items still need a look in a real practice test:

- [ ] Review screen layout and wording (separate page? grid states? submit button text). Not seen; Blackbook's is assumed.
- [x] Student-produced answer preview exists ("Answer Preview:" under the box). Its rendering of a typed value: not seen.
- [ ] Break screen: what is shown, what the button says after zero, whether the countdown is visible.
- [x] Calculator: floating panel, Graphing and Scientific modes, drag handle, corner resize, close (not embedded in Blackbook: see docs/calculator-spec.md).
- [ ] Calculator: Scientific mode on screen; whether expressions persist between questions.
- [x] "." and "-" count toward the limits (inferred from the examples table).
- [ ] Whether "/" counts toward the limits.
- [ ] Where student-produced items sit inside a Math module.
- [ ] Order of skills inside a Reading and Writing domain.
- [ ] What the five-minute alert looks like.
- [x] Header tools per section, question bar controls, eliminator only on multiple choice, footer without Back on question 1, question menu legend and "Go to Review Page", More menu items, highlight toolbar controls, reference sheet contents and docking.
- [ ] Directions dropdown open; Help, Shortcuts and Assistive Technology contents; the Math More menu.
- [ ] Line reader on screen; unscheduled break screen; exit dialog.
- [ ] Figure full-screen view; zoom levels other than 100%.
- [ ] Highlight note editor; the underline style dropdown.
- [ ] Whether the eliminator starts on or off; what a struck choice does when clicked.
- [ ] Timer hidden state and the five-minute warning.
