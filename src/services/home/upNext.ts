// Home "Up next": the one primary action, chosen by code in a fixed priority order, with a one-line
// reason. Pure.
//   1. an unfinished session (the most recent one; the rest behind "see all in progress");
//   2. retries due today;
//   3. enough data for a weak-skill drill;
//   4. otherwise a 20-question drill.

import { MIN_SKILL_ANSWERS, WEAK_SKILL_COUNT } from '../ai/weakDrill';
import type { Section } from '../../types/sat';
import type { InProgressRow } from '../../types/session';

export const STARTER_DRILL_SIZE = 20;
/** A weak-skill drill is offered once this many skills each have MIN_SKILL_ANSWERS first attempts. */
export const WEAK_READY_SKILLS = 3;

export type UpNext =
  | { kind: 'resume'; sessionId: string; isTest: boolean; label: string; reason: string }
  | { kind: 'retry'; due: number; label: string; reason: string }
  | { kind: 'weak_drill'; skills: number; label: string; reason: string }
  | { kind: 'start_drill'; size: number; section: Section; label: string; reason: string };

export interface UpNextInputs {
  /** Newest activity first (inProgressRows). */
  inProgress: readonly InProgressRow[];
  retryDue: number;
  /** Skills with at least MIN_SKILL_ANSWERS first attempts (hidden sessions not counted). */
  rankableSkills: number;
  /** The section you have answered fewer first attempts in (Reading and Writing on a tie). */
  starterSection: Section;
}

export interface UpNextChoice {
  primary: UpNext;
  /** Other unfinished sessions, shown as "see all in progress" when above 0. */
  moreInProgress: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function pickUpNext(i: UpNextInputs): UpNextChoice {
  const latest = i.inProgress[0];
  const moreInProgress = Math.max(0, i.inProgress.length - 1);
  if (latest) {
    const what = latest.kindLabel.toLowerCase();
    const label = latest.isTest
      ? `Resume ${what}, ${latest.progressLabel ?? 'in progress'}`
      : `Resume ${what}, ${latest.answered} of ${latest.total} answered`;
    return {
      primary: { kind: 'resume', sessionId: latest.id, isTest: latest.isTest === true, label, reason: `${latest.sectionLabel}. You left it unfinished; pick up where you stopped.` },
      moreInProgress,
    };
  }
  if (i.retryDue > 0) {
    return {
      primary: { kind: 'retry', due: i.retryDue, label: `Review ${plural(i.retryDue, 'question', 'questions')} due today`, reason: 'Questions you missed earlier are due for another try.' },
      moreInProgress,
    };
  }
  if (i.rankableSkills >= WEAK_READY_SKILLS) {
    const n = Math.min(WEAK_SKILL_COUNT, i.rankableSkills);
    return {
      primary: { kind: 'weak_drill', skills: n, label: `Practice your ${n} weakest skills`, reason: `Picked from your first attempts; each skill has at least ${MIN_SKILL_ANSWERS} answers.` },
      moreInProgress,
    };
  }
  return {
    primary: {
      kind: 'start_drill',
      size: STARTER_DRILL_SIZE,
      section: i.starterSection,
      label: `Start a ${STARTER_DRILL_SIZE}-question drill`,
      reason: `${i.starterSection === 'rw' ? 'Reading and Writing' : 'Math'}, all domains, questions you have not seen first. It is the section you have practiced less.`,
    },
    moreInProgress,
  };
}

/** Skills with enough first attempts to rank, from countable first attempts and each question's skill. */
export function countRankableSkills(firstAttempts: readonly { questionId: string }[], skillOf: ReadonlyMap<string, string>): number {
  const n = new Map<string, number>();
  for (const a of firstAttempts) {
    const s = skillOf.get(a.questionId);
    if (s) n.set(s, (n.get(s) ?? 0) + 1);
  }
  return [...n.values()].filter((c) => c >= MIN_SKILL_ANSWERS).length;
}
