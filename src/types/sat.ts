// Normalized question shape. Single source of truth for sync, import, storage and UI.
// See docs/api-notes.md for how each field maps to the College Board API.

export type Section = 'rw' | 'math';
export type Difficulty = 'E' | 'M' | 'H';
export type ChoiceLetter = 'A' | 'B' | 'C' | 'D';

export const SECTIONS: readonly Section[] = ['rw', 'math'];
export const DIFFICULTIES: readonly Difficulty[] = ['E', 'M', 'H'];
export const CHOICE_LETTERS: readonly ChoiceLetter[] = ['A', 'B', 'C', 'D'];

export type QuestionSource = 'digital' | 'legacy';

/** How the answer key was obtained. 'rationale' means parsed from explanation prose (legacy only). */
export type AnswerKeyOrigin = 'structured' | 'rationale';

export interface McqAnswer {
  kind: 'mcq';
  /** Exactly four choices, in A-D order. HTML. */
  choices: [string, string, string, string];
  correct: ChoiceLetter;
  keyOrigin: AnswerKeyOrigin;
}

export interface SprAnswer {
  kind: 'spr';
  /** Every accepted answer string as published, e.g. ["1/3", ".3333", "0.3333"]. Never empty. */
  accepted: string[];
}

export type Answer = McqAnswer | SprAnswer;

export interface Question {
  /** external_id for digital items, ibn for legacy items. Stable across syncs. */
  id: string;
  source: QuestionSource;
  /** Short id shown in the question bank UI (questionId). */
  displayId: string;
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
  /** score_band_range_cd, 1 to 7. */
  scoreBand: number;
  /** Listed in the bank's "active questions" set. */
  active: boolean;
  /** Sanitized HTML. Math is <span class="bb-math" data-latex> or kept MathML; graphs are inline SVG. */
  stimulusHtml: string | null;
  stemHtml: string;
  answer: Answer;
  rationaleHtml: string;
  /** updateDate from the list endpoint, epoch ms. */
  updatedAt: number;
}

export interface SkippedQuestion {
  id: string;
  reason: string;
}

export const BANK_SCHEMA_VERSION = 1;

export interface QuestionBank {
  schemaVersion: typeof BANK_SCHEMA_VERSION;
  /** ISO timestamp of the sync run. */
  fetchedAt: string;
  questions: Question[];
  skipped: SkippedQuestion[];
}
