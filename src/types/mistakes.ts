// Mistake tags (Phase 6). A tag says why a question was missed. Tags live in their own append-only
// table keyed by (session, question); attempts are never changed. The newest tag for a pair is the
// one in force and the older ones are kept as history. Records hold ids, a reason and an optional
// one-line note; never question text.

export type MistakeReason = 'careless' | 'concept_gap' | 'misread' | 'ran_out_of_time' | 'guessed' | 'other';

export const MISTAKE_REASONS: readonly MistakeReason[] = ['careless', 'concept_gap', 'misread', 'ran_out_of_time', 'guessed', 'other'];

export const MISTAKE_REASON_LABEL: Record<MistakeReason, string> = {
  careless: 'Careless',
  concept_gap: 'Concept gap',
  misread: 'Misread',
  ran_out_of_time: 'Ran out of time',
  guessed: 'Guessed',
  other: 'Other',
};

/** Longest note kept, in characters. The note is stored on this device only and never goes into an event. */
export const MISTAKE_NOTE_MAX = 200;

/** One tag action. */
export interface MistakeTag {
  /** Made on the device, so a resend never duplicates a row. */
  id: string;
  sessionId: string;
  questionId: string;
  reason: MistakeReason;
  note: string;
  /** True when the user accepted the app's suggestion unchanged. */
  suggested: boolean;
  /** Epoch ms. */
  at: number;
}

/** The suggestion shown next to an untagged miss. It is only a suggestion: nothing is saved until the user confirms. */
export interface MistakeSuggestion {
  reason: MistakeReason;
  /** One plain sentence saying where the suggestion comes from. */
  why: string;
}

/** One missed or unanswered question of a finished session, ready for the review screen. */
export interface MistakeItem {
  sessionId: string;
  questionId: string;
  /** 0-based position in the session. */
  index: number;
  /** True when no answer was given. */
  unanswered: boolean;
  timeMs: number;
  /** The tag in force, or null. */
  tag: MistakeTag | null;
  /** Null when there is no basis for a suggestion, or when a tag already exists. */
  suggestion: MistakeSuggestion | null;
}

/** The mistake log: every question whose latest tag is in force, with the facts needed to filter. */
export interface MistakeLogRow {
  tag: MistakeTag;
  /** How many tag actions this pair has, history included. */
  versions: number;
  section: 'rw' | 'math';
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: 'E' | 'M' | 'H';
  displayId: string;
}

/** Reads and writes mistake tags. UI and services use this interface only (AGENTS.md rule 6). */
export interface MistakeStore {
  /** Appends a tag action. Idempotent on `tag.id`. */
  addTag(tag: MistakeTag): Promise<void>;
  /** Every tag action, oldest first. */
  listTags(): Promise<MistakeTag[]>;
}
