// Types for drill mode: configuration, facets, derived statistics and the props contracts the
// setup and skills screens are built against. Sessions, attempts and telemetry are in session.ts.

import type { Difficulty, Section } from './sat';

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
  /**
   * Serve exactly these questions in this order (oldest miss first, from the Study next screen),
   * in place of choosing by the filters above. Ids missing from the bank are dropped.
   */
  questionIds?: string[];
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

export interface FlagRecord {
  questionId: string;
  at: number;
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

export interface MySkillsProps {
  /** Already sorted weakest first. */
  rows: SkillStatRow[];
  /** Attempts on questions no longer in the bank, not shown in rows. */
  unattributed: number;
  onBack: () => void;
}
