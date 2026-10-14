# College Board Educator Question Bank: API notes

Verified by direct requests from a dev machine on 2026-10-14. Everything below was observed, not assumed. Raw responses live in `fixtures/probe/` (git-ignored) and are never committed.

These are undocumented internal endpoints of a public website. They can change or disappear without notice. The sync script must fail loudly on shape changes rather than guess.

## Hosts

| Host | Role |
|---|---|
| `satsuitequestionbank.collegeboard.org` | 301 redirect to `satsuiteeducatorquestionbank.collegeboard.org` |
| `satsuiteeducatorquestionbank.collegeboard.org` | Static React SPA (one bundle, `/assets/index-*.js`). Behind Akamai Bot Manager (`_abck`, `bm_sz` cookies). Not needed for sync. |
| `qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/` | JSON API. AWS API Gateway + CloudFront. No Akamai, no cookies, no auth, no API key. |

Endpoints were found by reading the SPA bundle, not from older notes. The endpoints in the original scaffold (`/api/questions/search`, `/api/questions/detail` on `satsuitequestionbank`) do not exist in the bundle.

## Endpoints

### `GET /lookup`

Taxonomy and metadata. Response keys: `lookupData`, `readingLiveItems`, `mathLiveItems`, `stateOfferings`.

- `lookupData.assessment`: `[{text, id}]`. SAT = `"99"`, PSAT/NMSQT & PSAT 10 = `"100"`, PSAT 8/9 = `"102"`.
- `lookupData.test`: Reading and Writing = `"1"`, Math = `"2"`.
- `lookupData.domain["R&W" | "Math"]`: `[{text, id, primaryClassCd, skill: [{text, id}]}]`.
- `readingLiveItems` (1110 ids), `mathLiveItems` (927 ids): question ids flagged as "live". The site uses this for its "exclude active questions" filter. 1092 of the 1110 R&W live ids and all 927 Math live ids are in the SAT lists. That is 59% of SAT R&W and 48% of SAT Math.
- `stateOfferings`: US state list for the standards-alignment feature. Not needed.

Domain codes (`primary_class_cd`):

| Section | Domain | Code |
|---|---|---|
| R&W | Information and Ideas | `INI` |
| R&W | Craft and Structure | `CAS` |
| R&W | Expression of Ideas | `EOI` |
| R&W | Standard English Conventions | `SEC` |
| Math | Algebra | `H` |
| Math | Advanced Math | `P` |
| Math | Problem-Solving and Data Analysis | `Q` |
| Math | Geometry and Trigonometry | `S` |

### `POST /digital/get-questions` (list)

Body (JSON): `{"asmtEventId": 99, "test": 1, "domain": "INI,CAS,EOI,SEC"}`. `domain` is a comma-joined list of `primary_class_cd` values. For Math: `{"asmtEventId": 99, "test": 2, "domain": "H,P,Q,S"}`.

Returns a plain JSON array with every matching question in one response. **No pagination.** About 720 KB per section, about 1.5 s.

Row fields:

| Field | Observed | Notes |
|---|---|---|
| `questionId` | 8 hex chars | Short id shown in the site UI. |
| `external_id` | UUID or `null` | Set for "digital" items. Detail key. |
| `ibn` | e.g. `"022222-DC"` or `""` | Set for "legacy" items. Detail key when `external_id` is null. |
| `uId` | UUID | Row id. |
| `program` | `"SAT"` | |
| `pPcc` | e.g. `"SAT#H"` | program + domain code |
| `primary_class_cd`, `primary_class_cd_desc` | domain code and name | |
| `skill_cd`, `skill_desc` | e.g. `"H.A."`, skill name | |
| `difficulty` | `"E"` / `"M"` / `"H"` | |
| `score_band_range_cd` | 1 to 7 | E covers 1–3, M covers 4–5, H covers 6–7 (Math, observed). |
| `createDate`, `updateDate` | epoch ms | Usable for incremental resync. |

### `POST /digital/get-question` (detail)

Body: `{"external_id": "<external_id>"}`. For legacy items the site sends the `ibn` in the same `external_id` field: `{"external_id": "022222-DC"}`.

Two response shapes:

**Digital** (keyed by UUID):

```
type: "mcq" | "spr"
stimulus?: html string        (passage, table, figure; absent on many math items)
stem: html string
answerOptions?: [{id: uuid, content: html}]   (mcq only, 4 options in samples)
correct_answer: string[]       (mcq: ["B"]; spr: one or more accepted answers, e.g. ["403"])
keys: string[]                 (mcq: answerOption id of the correct choice; spr: same as correct_answer)
rationale: html string
externalid: uuid
optional: vaultid, origin ("proteus"), templateclusterid, parenttemplatename, position, ...
```

Math in digital items is inline MathML (`<math>`, `mi`, `mn`, `mo`, `mrow`, `mfrac`, `msup`, and the deprecated `<mfenced>`).

**Legacy** (keyed by `ibn`, ids end in `-DC`, Math only):

```
item_id: "022222-DC"
section: "Math"
body?: html string             (stimulus)
prompt: html string            (stem)
answer: {
  style: "Multiple Choice" | ...,
  choices: {a: {body: html}, b: {...}, c: {...}, d: {...}},
  correct_choice: "a" | "b" | "c" | "d",
  rationale: html string
}
```

Legacy math is **not MathML**. It is `<img class="math-img" role="math" src="data:image/png;base64,...">` with a spoken-math `alt` attribute. These cannot be converted to KaTeX and must be rendered as images.

## Counts (SAT, asmtEventId 99, fetched 2026-10-14)

| | Rows | Distinct ids | Digital | Legacy | Not in live arrays |
|---|---|---|---|---|---|
| Reading and Writing | 1845 | 1845 | 1845 | 0 | 753 |
| Math | 1925 | 1922 | 1466 | 459 | 995 |

Per domain (rows): R&W: Information and Ideas 555, Craft and Structure 471, Expression of Ideas 398, Standard English Conventions 421. Math: Algebra 616 (legacy 132), Advanced Math 540 (legacy 127), Problem-Solving and Data Analysis 421 (legacy 143), Geometry and Trigonometry 348 (legacy 57).

Per difficulty (distinct ids): R&W: E 611, M 624, H 610. Math: E 684, M 629, H 609.

Math has 3 ids listed twice with different `questionId` and `updateDate`. Sync must dedupe by id and keep the newest `updateDate`.

`skill_desc` is not a stable key: R&W has both "Cross-Text Connections" and "Cross-text Connections". Key skills by `skill_cd` and take the display name from `/lookup`.

Skill x difficulty, distinct ids, shown as `all / not in live arrays`:

| Domain | Skill | E | M | H |
|---|---|---|---|---|
| CAS | Words in Context | 142/34 | 58/26 | 61/28 |
| CAS | Text Structure and Purpose | 51/21 | 56/21 | 42/17 |
| CAS | Cross-Text Connections (both spellings) | 9/8 | 25/14 | 27/18 |
| INI | Central Ideas and Details | 41/19 | 52/21 | 45/21 |
| INI | Inferences | 20/10 | 48/21 | 72/37 |
| INI | Command of Evidence | 71/29 | 85/39 | 121/55 |
| EOI | Rhetorical Synthesis | 37/13 | 124/49 | 43/20 |
| EOI | Transitions | 80/27 | 73/26 | 41/17 |
| SEC | Boundaries | 61/18 | 55/23 | 97/43 |
| SEC | Form, Structure, and Sense | 99/26 | 48/21 | 61/31 |
| H | Linear equations in one variable | 64/20 | 28/20 | 20/13 |
| H | Linear functions | 82/27 | 56/27 | 32/21 |
| H | Linear equations in two variables | 56/30 | 41/27 | 33/22 |
| H | Systems of two linear equations in two variables | 38/17 | 46/20 | 42/19 |
| H | Linear inequalities in one or two variables | 29/12 | 29/16 | 19/9 |
| P | Nonlinear functions | 65/21 | 91/38 | 102/47 |
| P | Nonlinear equations in one variable and systems of equations in two variables | 42/18 | 60/32 | 62/30 |
| P | Equivalent expressions | 43/22 | 39/26 | 34/25 |
| Q | Ratios, rates, proportional relationships, and units | 42/16 | 32/17 | 19/9 |
| Q | Percentages | 28/15 | 22/9 | 34/15 |
| Q | One-variable data: Distributions and measures of center and spread | 37/18 | 21/15 | 26/14 |
| Q | Two-variable data: Models and scatterplots | 34/15 | 26/14 | 11/8 |
| Q | Probability and conditional probability | 24/13 | 14/11 | 11/9 |
| Q | Inference from sample statistics and margin of error | 10/6 | 13/10 | 5/4 |
| Q | Evaluating statistical claims: Observational studies and experiments | 2/2 | 3/3 | 7/7 |
| S | Area and volume | 36/20 | 38/23 | 36/20 |
| S | Lines, angles, and triangles | 40/22 | 29/18 | 33/18 |
| S | Right triangles and trigonometry | 8/4 | 19/11 | 42/26 |
| S | Circles | 4/4 | 22/16 | 41/24 |

## Markup (survey of 144 detail items, one per skill x difficulty x digital/legacy)

- **MathML** (digital only): every `<math>` has an `alttext` attribute (spoken form) and most have `xmlns`. No `display="block"` was seen; all math is inline. Elements include `mrow`, `mi`, `mn`, `mo`, `mfrac`, `msup`, `mtext`, `mspace` and the deprecated `<mfenced>` (192 occurrences). Chrome's native MathML Core does not render `mfenced`, so native MathML is not a safe fallback by itself.
- **SVG** (digital only, 15 of 144 items, mostly math graphs): inline `<svg>` with `width`, `height`, `viewBox`, `role`, `aria-label` on every one. Graphs are matplotlib output: colors live in `style="fill:...;stroke:..."` on SVG elements and text glyphs are `<path>`s reused through `<use>`, so a sanitizer that strips SVG `style` renders a blank box. Some use `<use>` with `xlink:href="#id"`, so ids inside SVGs must be made unique per question when more than one SVG is on screen.
- **Legacy images**: 480 `<img class="math-img" role="math">` tags, all `data:image/png;base64`, each with a spoken-math `alt`. No external image URLs anywhere.
- `<figure>` (19 items), `<table>` (12 items).
- No `<script>`, `<iframe>`, `on*` handlers or `javascript:` URLs in the sample. The imported file is still untrusted input and gets sanitized.
- Two legacy rationales contain an accessibility-widget artifact saved into the content: `<div data-ae_invis="true" id="level-access-access-assistant-highlight-container">&nbsp;</div>`. Strip it.

## Answer keys

- Digital mcq: `correct_answer` is a one-letter array; `keys` holds the matching `answerOptions[].id`.
- Digital spr: `correct_answer` is an array of accepted answers (one or more).
- Legacy: `answer.style` is `"Multiple Choice"` or `"SPR"`. **All 8 sampled legacy SPR items and 2 of 49 legacy MCQ items have no structured answer**; the answer appears only in rationale prose ("Choice C is correct.", "The correct answer is 4."). Roughly 17% of legacy items in the sample.

## CORS

`OPTIONS` and `POST` from an arbitrary origin return `Access-Control-Allow-Origin: *` with `Content-Type` allowed. Verified from real browser pages on `http://localhost:3000` and `https://example.org` (2026-10-14). No `Access-Control-Expose-Headers`, so browser code cannot read `Retry-After`. Not relevant any more: downloads run in the local Bun process, not the browser.

## Rate limits

About 150 sequential requests at 1 request per 1.5 s: all 200, no throttling headers (`x-ratelimit-*`, `retry-after`) seen, no 429. The limit is unknown, not absent. A full SAT sync is about 3770 detail requests.

## Speed and concurrency (measured 2026-10-14, 85 requests in total)

- The source's own web app fetches the lookup once, the list once per search, and **one detail at a time** when a user opens a question. It never has several detail requests in flight.
- Two runs of 40 random detail requests, 3 minutes apart, 250 ms minimum gap per worker:

  | In flight | Median | p95 | Rate | Throttling signals |
  |---|---|---|---|---|
  | 1 | 519 ms | 741 ms | 1.9 per second | none |
  | 2 | 518 ms | 708 ms | 3.9 per second | none |

  Latency was flat. 3 and 4 in flight were not tested because they exceed the site's own pattern. The app keeps 2 (`src/services/sync/limits.ts`).
- No free wins: list rows carry no content fields; the detail endpoint rejects several ids (array or comma-joined both return the `NoSuchKey` error); neither endpoint compresses its response even when asked (`Accept-Encoding: gzip, br`). Details are about 7 to 9 KB.
- A missing detail returns **HTTP 200** with an error body (`{"$fault":"client", ..., "Code":"NoSuchKey"}`). Status codes alone do not catch bad details; the shape guard does.
- The site also has `POST /pdf-download-v2`, a server-side PDF export job it polls. Not usable as data.
- Normalizing a full bank takes about 0.09 s per question (338 s for 3,767 in one run), so a full first download is roughly 16 minutes of requests plus 6 minutes of preparing.

## Not yet verified

- The 18 ids in `readingLiveItems` that are not in the SAT R&W list. Possibly PSAT-only items.
- Markup outside the 144-item sample. The full sync will report any element it cannot handle.
- PSAT banks (`asmtEventId` 100, 102): overlap with SAT not measured. Out of scope for Phase 1.
