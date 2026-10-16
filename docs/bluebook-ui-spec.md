# Test-room UI spec (from screenshots of the real test app)

Behavior and layout only: no colors, names, artwork or copied wording (AGENTS.md rules 1 and 2). Written by Gemini 3.8 Flash from the owner's 9 screenshots (2026-10-16, kept in `handoff/screens/bluebook/`, never committed) and corrected by Claude against the images. What Blackbook builds from it, and its own choices, are in `docs/exam-spec.md` ("Test room").

## 1. Sources

- `Screenshot 2026-10-16 115528.png`: Full test room screen in Math multiple-choice (question 1 of 7) showing an open floating graphing calculator on the left, an inline scatterplot figure, and multiple-choice options.
- `Screenshot 2026-10-16 115819.png`: Full test room screen in Math multiple-choice (question 1 of 7) with both floating calculator open on the left and docked reference panel open on the right, shifting question content into the center.
- `Screenshot 2026-10-16 115847.png`: Full test room screen in Math student-produced response (question 7 of 7) displaying a three-pane layout with response directions on the left, question prompt and answer input in the center, and docked reference panel open on the right.
- `Screenshot 2026-10-16 120735.png`: Full test room screen in Reading and Writing (question 1 of 8) displaying a two-pane 50/50 layout with passage on the left and question prompt with choices on the right.
- `Screenshot 2026-10-16 120755.png`: Cropped view of the More menu dropdown opened from the top-right header, displaying six utility actions with leading icons.
- `Screenshot 2026-10-16 120811.png`: Cropped popup of the question navigation menu opened from the footer, showing module title, three-state legend, question tile grid, and review page button.
- `Screenshot 2026-10-16 120919.png`: Cropped top header bar in Math displaying section title, directions trigger, center timer with hide control, and utility action buttons.
- `Screenshot 2026-10-16 120951.png`: Full test room screen in Math student-produced response (question 3 of 7) displaying a two-pane layout with response directions on the left and question prompt, answer input field, and preview on the right (reference panel closed).
- `Screenshot 2026-10-16 121031.png`: Cropped modal/docked view of the Reference sheet showing geometry formulas, the three facts, and the expand and close controls.

## 2. Regions

### Header
- **Left**: Section title (e.g. "Section 1: Reading and Writing", "Section 2: Math") with "Directions" trigger button directly beneath it featuring a chevron dropdown indicator.
- **Center**: Countdown timer display ("0:00" MM:SS format) with a text toggle button ("Hide") directly below it.
- **Right**: Utility action buttons:
  - In Math: "Calculator", "Reference", and "More" (vertical three dots icon).
  - In Reading and Writing: "Highlights & Notes" and "More" (vertical three dots icon). Calculator and Reference do not appear.
- **Top-right corner**: a small zoom percentage ("100%") above the tools.

### Banner
- A preview-only banner; not copied.

### Main Area Panes and Divider
- **Two-Pane Split**: Used in Reading and Writing (passage on left, question and choices on right) and Math Student-Produced Response without Reference open (directions on left, question and input on right). Separated by a vertical divider with a small drag handle near the top (the handle implies the split can be dragged; dragging it is not shown).
- **Three-Pane Split**: Used in Math Student-Produced Response when Reference panel is open (directions on left pane, question and input in center pane, reference panel on right pane).
- **Single / Shifted Pane**: Used in Math Multiple Choice. Content occupies the right/center space when Calculator floats on the left, and shifts leftward when Reference panel docks on the right.

### Question Header Bar
- Sits directly above the question stimulus inside the question container.
- **Left**: Question number indicator badge.
- **Right**:
  - "Mark for Review" control with bookmark icon.
  - Crossed-out letter control (eliminator toggle). Present on multiple-choice questions; absent on student-produced response questions.

### Choices (Multiple Choice)
- Vertically stacked full-width bordered rectangular cards.
- **Left**: Circular letter badge (A, B, C, D).
- **Center**: Choice answer text.
- **Right**: Crossed-out letter strike-out icon button to eliminate that choice individually.

### Figures
- Rendered inline within the question stimulus between introductory text and prompt.
- Includes an action bar above the figure: zoom in, zoom out, the zoom percentage ("100%"), Reset, and a full-screen control.

### Student-Produced Response Input and Preview
- **Directions Pane (Left)**:
  - A heading, then the rules as bullets (facts, our words): only one answer even if several are correct; up to 5 characters for a positive answer and 6 for a negative one including the sign; a fraction that does not fit goes in as its decimal; a decimal that does not fit is truncated or rounded at the fourth digit; a mixed number goes in as an improper fraction or a decimal; no percent sign, comma or dollar sign.
  - An examples table with three columns: the answer, ways that get credit, and ways that do not. Values (facts): 3.5 accepted as 3.5, 3.50, 7/2, rejected as 31/2 and 3 1/2; 2/3 accepted as 2/3, .6666, .6667, 0.666, 0.667, rejected as 0.66, .66, 0.67, .67; -1/3 accepted as -1/3, -.3333, -0.333, rejected as -.33 and -0.33.
- **Question Pane (Right/Center)**:
  - Question text prompt.
  - A small input box with an underline inside it, directly under the question (no visible label).
  - Read-only label "Answer Preview:" positioned directly below the input field.

### Reference Panel
- **Header**: Title "Reference" with an expand control and a close button ("X") at the right.
- Docked on the right at full height; opening it narrows the question area, closing it gives the space back.
- **Body**: Geometry formulas and reference facts:
  - Circle: Area ($A = \pi r^2$), Circumference ($C = 2\pi r$).
  - Rectangle: Area ($A = ell w$).
  - Triangle: Area ($A = \frac{1}{2} b h$).
  - Right Triangle: Pythagorean theorem ($c^2 = a^2 + b^2$).
  - Special Right Triangles: $30^\circ-60^\circ-90^\circ$ ($x, x\sqrt{3}, 2x$) and $45^\circ-45^\circ-90^\circ$ ($s, s, s\sqrt{2}$).
  - Volume: Rectangular prism ($V = l w h$), Cylinder ($V = \pi r^2 h$), Sphere ($V = \frac{4}{3} \pi r^3$), Cone ($V = \frac{1}{3} \pi r^2 h$), Pyramid ($V = \frac{1}{3} l w h$).
  - Facts: Degrees of arc in a circle is 360; Radians of arc in a circle is $2\pi$; Sum of triangle angle measures in degrees is 180.

### Calculator Panel
- Floating panel. Top bar: a two-way switch "Graphing" / "Scientific" (Graphing selected), a grip (drag handle), and a close button ("X").
- Graphing mode: the graph on top with a graph-settings (wrench) control and zoom in / zoom out on its right edge; the default window shows about -10 to 10 horizontally. Below it a toolbar (add expression, keyboard, undo, redo, settings, collapse) and a numbered expression list.
- A resize handle at the lower-right corner.
- Position: over the empty left side on Math multiple choice; over the question column on student-produced response questions.

### Highlights Toolbar
- Reading and Writing only; the header shows "Highlights & Notes".
- Seen floating just above a text selection in the passage: three color swatches (the first selected), an underline control with a small dropdown arrow, a delete control, and a note control. Highlighted text shows the color behind it.

### More Menu
- Dropdown popup anchored beneath "More" header button.
- Contains six vertical list options, each with a leading icon:
  1. Help
  2. Shortcuts
  3. Assistive Technology
  4. Line Reader
  5. Unscheduled Break
  6. Exit the Exam

### Question Menu Popup
- Opens upward from footer trigger button ("Question X of Y").
- **Header**: Section title with question scope (e.g. "Section 1: Reading and Writing Questions").
- **Legend Bar**:
  - Current (pointer indicator above tile).
  - Unanswered (dashed square outline).
  - For Review (bookmark icon on tile).
- **Question Grid**: Grid of square numbered tiles (1 to N).
- **Footer Action**: Button labeled "Go to Review Page".

### Footer
- **Left**: Student full name.
- **Center**: Question navigation button labeled "Question X of Y" with chevron toggle indicator.
- **Right**:
  - "Back" button: Secondary outlined button. Absent on Question 1; present on subsequent questions.
  - "Next" button: the primary action. Present on all questions, including the final question of the module.

## 3. Section and Question Type Differences

- **Reading and Writing**:
  - Main area is a 50/50 two-pane split (passage stimulus on left, question and choices on right).
  - Header displays "Highlights & Notes" and "More"; Calculator and Reference are absent.
  - Question header bar includes question number badge, "Mark for Review", and crossed-out letter control.
  - Answer choices show individual strike-out buttons.
- **Math Multiple Choice**:
  - Main area is single-column / shifted layout.
  - Header displays "Calculator", "Reference", and "More"; Highlights & Notes is absent.
  - Floating Calculator sits over the left area without shifting question content.
  - Opening the Reference panel docks it on the right side and shifts question content into the remaining left/center space.
  - Question header bar includes question number badge, "Mark for Review", and crossed-out letter control.
- **Math Student-Produced Response**:
  - Main area is a two-pane layout (directions on left, question and input on right) when Reference is closed.
  - When Reference panel opens, main area becomes a three-pane layout (directions on left, question and input in center, Reference docked on right).
  - Question header bar includes question number badge and "Mark for Review", but omits the crossed-out letter control.
  - Multiple-choice option cards and strike-out buttons are absent; replaced with single "Answer:" text field and "Answer Preview:".

## 4. States Seen

- **Active Header Panel Underline**: "Calculator" and "Reference" header buttons display a distinct underline while their corresponding panel or window is open.
- **Eliminator Toggle On**: Crossed-out letter control toggled in question header; each choice card displays an individual strike-out button on its right side.
- **Current Question Indicator**: In the question menu popup, the active question tile has a downward-pointing indicator directly above it.
- **Tile Boundary State**: In the question menu popup, unanswered question tiles display dashed square outlines.
- **Bookmark / For Review State**: "Mark for Review" displays bookmark icon; question menu popup legend includes For Review bookmark marker.
- **First Question Navigation**: "Back" button is absent on Question 1; only "Next" is rendered.
- **Final Question Navigation**: "Next" button remains visible on the last question of the module (e.g. Question 7 of 7); it does not change text to "Review".

## 5. Not Seen List

The screenshots do not show the following states and behaviors:
- Review page layout and content.
- What clicking "Next" on the final question of a module leads to (e.g. review screen, confirmation modal, or next module transition).
- Answer Preview populated with content (both SPR screenshots show empty answer input and empty preview).
- Typed fraction or decimal formatting in the Answer Preview.
- Line Reader active on-screen appearance and interaction controls.
- Unscheduled Break screen or lock state.
- Help modal or drawer contents.
- Keyboard Shortcuts modal contents.
- Assistive Technology settings or drawer contents.
- Directions dropdown open state and full text.
- Calculator Scientific mode (only Graphing Calculator mode is shown).
- Figure full-screen or expanded modal view.
- Timer hidden state (after clicking "Hide").
- Five-minute remaining timer warning alert or banner.
- The note editor; the underline style dropdown open; the "Highlights & Notes" header button's own action.
- Answered question tile state in the question menu popup or legend (only Current, Unanswered, and For Review are displayed).
- Exit the Exam confirmation dialog or warning modal.
