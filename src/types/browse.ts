// Browse: the question list with seen and done status, its filters, and the screen contracts.
// Status is derived from attempts, events and sessions every time; it is never stored.

import type { Difficulty, QuestionSource, Section } from './sat';

/** Unseen: never on screen. Seen: shown at least once, no final answer. Done: a final answer exists. */
export type SeenStatus = 'unseen' | 'seen' | 'done';
export type LastResult = 'correct' | 'incorrect';

/** Status of one question, as the local program derives it. Only questions with any history are listed. */
export interface QuestionStatus {
  questionId: string;
  /** Shown on screen in any session (a question_shown event), or answered before the event log existed. */
  seen: boolean;
  /** A final answer exists in any session. */
  done: boolean;
  /** Final, non-empty answers across all sessions. */
  attempts: number;
  /** From the newest final answer in a finished session only. Null when there is none. */
  lastResult: LastResult | null;
  /** On the cross-session "flag for later" list. */
  flagged: boolean;
}

/** One row of the browse list: the question's facets plus its status. No question content. */
export interface BrowseRow {
  id: string;
  displayId: string;
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
  format: 'mcq' | 'spr';
  source: QuestionSource;
  /** In the bank's live set. */
  active: boolean;
  status: SeenStatus;
  attempts: number;
  lastResult: LastResult | null;
  flagged: boolean;
}

export interface BrowseFilters {
  section: Section | 'all';
  domainCode: string;
  skillCode: string;
  difficulty: Difficulty | 'all';
  format: 'mcq' | 'spr' | 'all';
  source: QuestionSource | 'all';
  live: 'all' | 'yes' | 'no';
  /** "seen" includes done questions; "not_done" includes unseen ones. */
  status: 'all' | 'unseen' | 'seen' | 'done' | 'not_done';
  flagged: 'all' | 'yes';
  lastResult: 'all' | 'correct' | 'incorrect' | 'none';
}

export const DEFAULT_BROWSE_FILTERS: BrowseFilters = {
  section: 'all',
  domainCode: 'all',
  skillCode: 'all',
  difficulty: 'all',
  format: 'all',
  source: 'all',
  live: 'all',
  status: 'all',
  flagged: 'all',
  lastResult: 'all',
};

/**
 * For each filter, how many rows each option would show given every other filter as it is.
 * Keys are option values ('all' included). Options with no rows are present with 0.
 */
export type FilterCounts = { [K in keyof BrowseFilters]: Record<string, number> };

export interface BrowseViewState {
  filters: BrowseFilters;
  /** 0-based page of BROWSE_PAGE_SIZE rows. */
  page: number;
}

export const BROWSE_PAGE_SIZE = 50;

export interface QuestionBrowserProps {
  /** Every question in the bank, in bank order. */
  rows: readonly BrowseRow[];
  /** Filters and page, owned by the parent so they survive leaving Browse and coming back. */
  state: BrowseViewState;
  onStateChange: (next: BrowseViewState) => void;
  /** Open one question for single-question practice. */
  onOpen: (questionId: string) => void;
  /** Practice a random question from the filtered rows (the parent prefers unseen ones). */
  onRandom: () => void;
}
