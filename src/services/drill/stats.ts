// Aggregations over stored attempts: which attempts count, and per-skill accuracy.

import { MIN_TRUSTED_ATTEMPTS, type QuestionFacet, type SkillStatRow } from '../../types/drill';
import type { SessionMode, SessionRecord, StoredAttempt } from '../../types/session';

/**
 * The attempts that statistics may use: final answers in finished sessions of one mode. Drafts,
 * unfinished and discarded sessions never count, and drill and exam results are kept apart.
 * Retry sessions are left out too: skill accuracy is about first attempts, and retry results are
 * reported on their own line (see services/retry/queue).
 */
export function countableAttempts(
  attempts: readonly StoredAttempt[],
  sessions: readonly SessionRecord[],
  mode: SessionMode,
): StoredAttempt[] {
  const finished = new Set(sessions.filter((s) => s.status === 'finished' && s.mode === mode && s.source !== 'retry').map((s) => s.id));
  return attempts.filter((a) => a.status === 'final' && a.mode === mode && a.response !== '' && finished.has(a.sessionId));
}

export interface SkillStats {
  rows: SkillStatRow[];
  /** Attempts whose question is no longer in the bank, so its skill is unknown. */
  unattributed: number;
}

/** Every attempt counts, including repeats of the same question. Sorted weakest (lowest accuracy) first. */
export function computeSkillStats(attempts: readonly StoredAttempt[], facets: readonly QuestionFacet[]): SkillStats {
  const byId = new Map(facets.map((f) => [f.id, f]));
  const acc = new Map<string, { f: QuestionFacet; attempts: number; correct: number; timeMs: number }>();
  let unattributed = 0;
  for (const a of attempts) {
    const f = byId.get(a.questionId);
    if (!f) {
      unattributed++;
      continue;
    }
    const row = acc.get(f.skillCode) ?? { f, attempts: 0, correct: 0, timeMs: 0 };
    row.attempts++;
    if (a.correct) row.correct++;
    row.timeMs += a.timeMs;
    acc.set(f.skillCode, row);
  }
  const rows: SkillStatRow[] = [...acc.values()].map((r) => ({
    skillCode: r.f.skillCode,
    skill: r.f.skill,
    domain: r.f.domain,
    section: r.f.section,
    attempts: r.attempts,
    correct: r.correct,
    accuracy: r.correct / r.attempts,
    avgTimeMs: r.timeMs / r.attempts,
    lowData: r.attempts < MIN_TRUSTED_ATTEMPTS,
  }));
  rows.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.skill.localeCompare(b.skill));
  return { rows, unattributed };
}
