// Test-room tools and layout numbers (Phase 9). Each value is marked VERIFIED (seen in the owner's
// screenshots of a real practice test or stated by an official source), ASSUMED or NOT SEEN.
// docs/exam-spec.md and docs/bluebook-ui-spec.md hold the sources.

import type { Section } from '../types/sat';
import type { CalculatorMode, PanelRect, ToolId } from '../types/testRoom';

/**
 * The complete tool list per section. VERIFIED against the official tools page (research notes)
 * and the screenshots: Reading and Writing has no calculator and no reference sheet; Math has no
 * highlights or line reader. The eliminator appears on multiple-choice questions only.
 */
export const TOOL_INVENTORY: Readonly<Record<Section, readonly ToolId[]>> = {
  rw: ['highlights', 'eliminator', 'markForReview', 'questionMenu', 'timerHide', 'directions', 'lineReader', 'zoom', 'more'],
  math: ['calculator', 'reference', 'eliminator', 'markForReview', 'questionMenu', 'timerHide', 'directions', 'zoom', 'more'],
};

/** The tools on screen for one question: the section's list, minus the eliminator on a typed answer. */
export function toolsFor(section: Section, answerKind: 'mcq' | 'spr'): ToolId[] {
  return TOOL_INVENTORY[section].filter((t) => t !== 'eliminator' || answerKind === 'mcq');
}

/** Test-room zoom steps in percent. ASSUMED: the screenshots show "100%" only, never another level. */
export const ZOOM_LEVELS: readonly number[] = [75, 90, 100, 110, 125, 150, 175, 200];
export const ZOOM_DEFAULT_INDEX = 2;

/** Figure zoom steps in percent. ASSUMED: the screenshots show the controls at 100% only. */
export const FIGURE_ZOOM_LEVELS: readonly number[] = [50, 75, 100, 125, 150, 200, 300];

/** VERIFIED (screenshots): the calculator opens in graphing mode with a window of about -10 to 10. */
export const CALCULATOR_DEFAULT_MODE: CalculatorMode = 'graphing';
/** ASSUMED: where the calculator first appears (left side, below the header) and its size. */
export const CALCULATOR_DEFAULT_RECT: PanelRect = { x: 64, y: 112, width: 380, height: 540 };
export const CALCULATOR_MIN_SIZE = { width: 280, height: 320 } as const;

/** ASSUMED: the left pane's starting share of the width (the screenshots show about half). */
export const SPLIT_DEFAULT_FRACTION = 0.5;
export const SPLIT_MIN_FRACTION = 0.2;
export const SPLIT_MAX_FRACTION = 0.8;

/** Blackbook's own limit on one note. */
export const ANNOTATION_NOTE_MAX = 1000;
/** Blackbook's own limit on highlights per question. */
export const ANNOTATIONS_MAX = 100;

/** ASSUMED: how many lines the line reader shows at once. NOT SEEN on screen. */
export const LINE_READER_LINES = 3;
