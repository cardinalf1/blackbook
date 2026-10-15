// Types for drill mode (Phase 2): configuration, stored user data, derived statistics and the
// props contracts that UI screens are built against. Question content lives in sat.ts.

import type { ChoiceLetter, Difficulty, Section } from './sat';

/** What the user chose on the setup screen. Empty skillCodes means every skill in the domain. */
export interface DrillConfig {
  section: Section;
  /** 'all' covers every domain in the section. */
  domainCode: string | 'all';
  /** Empty means all skills under the chosen domain. */
  skillCodes: string[];
  /** Empty means any difficulty. */
  difficulties: Difficulty[];
  /** Requested count. Never larger than the number of matching questions. */
  count: number;
  /** Only questions listed in the bank's live set. */
  liveOnly: boolean;
  /** Ask guess / unsure / sure after each answer. Off when missing. */
  askConfidence?: boolean;
}

/** The slice of a question the setup screen needs to count and list options. No content. */
export interface QuestionFacet {
  id: string;
  section: Section;
  domainCode: string;
  domain: string;
  skillCode: string;
  skill: string;
  difficulty: Difficulty;
  active: boolean;
}

export interface TaxonomySkill {
  skillCode: string;
  skill: string;
  /** Number of questions under this skill in the whole bank, live or not. */
  total: number;
}

export interface TaxonomyDomain {
  domainCode: string;
  domain: string;
  skills: TaxonomySkill[];
}

export interface TaxonomySection {
  section: Section;
  domains: TaxonomyDomain[];
}

/** One answered question, as stored. Keyed by question id only so it survives bank re-imports. */
export interface Attempt {
  /** `${sessionId}:${questionId}`. One attempt per question per session. */
  id: string;
  questionId: string;
  /** Choice letter for multiple choice, the typed text for student-produced response. */
  response: string;
  correct: boolean;
  /** Focus time with the question visible, in milliseconds. */
  timeMs: number;
  sessionId: string;
  /** Epoch ms when submitted. */
  at: number;
}

export interface FlagRecord {
  questionId: string;
  at: number;
}

export type AnsweredEntry = Pick<Attempt, 'response' | 'correct' | 'timeMs' | 'at'>;

export type SessionStatus = 'active' | 'finished';

/** A drill session, saved after every action so a closed tab can resume. */
export interface SessionRecord {
  id: string;
  config: DrillConfig;
  /** Question ids in the order they are asked. Fixed when the session starts. */
  queueIds: string[];
  /** Index of the question on screen. */
  index: number;
  startedAt: number;
  status: SessionStatus;
  /** Answered questions by id, so feedback can be shown again after a resume. */
  answered: Record<string, AnsweredEntry>;
  /** Struck-out choices by question id. */
  struck: Record<string, ChoiceLetter[]>;
  /** Focus time already spent on the unanswered question at `index`. */
  currentElapsedMs: number;
}

/** Per-question line in an end-of-session summary. */
export interface SummaryItem {
  questionId: string;
  displayId: string;
  skill: string;
  correct: boolean;
  timeMs: number;
}

export interface SessionSummary {
  total: number;
  correct: number;
  totalTimeMs: number;
  /** In the order asked. */
  items: SummaryItem[];
}

export interface SkillStatRow {
  skillCode: string;
  skill: string;
  domain: string;
  section: Section;
  attempts: number;
  correct: number;
  /** correct / attempts, 0 to 1. */
  accuracy: number;
  avgTimeMs: number;
  /** Fewer than MIN_TRUSTED_ATTEMPTS attempts: too few to trust. */
  lowData: boolean;
}

export const MIN_TRUSTED_ATTEMPTS = 5;

// ---- Props contracts for screens. Screens are thin: all logic arrives through these props. ----

export interface DrillSetupProps {
  taxonomy: TaxonomySection[];
  facets: readonly QuestionFacet[];
  /** Called with a config whose count is already capped (see capCount in services/drill/facets). */
  onStart: (config: DrillConfig) => void;
  onCancel: () => void;
}

export interface DrillResultsProps {
  summary: SessionSummary;
  /** Opens the question with its explanation. */
  onReview: (questionId: string) => void;
  onDone: () => void;
  onMySkills: () => void;
}

export interface MySkillsProps {
  /** Already sorted weakest first. */
  rows: SkillStatRow[];
  /** Attempts on questions no longer in the bank, not shown in rows. */
  unattributed: number;
  onBack: () => void;
}
