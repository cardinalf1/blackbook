// Aggregations over stored attempts: per-skill accuracy and the end-of-session summary.

import {
  MIN_TRUSTED_ATTEMPTS,
  type Attempt,
  type QuestionFacet,
  type SessionRecord,
  type SessionSummary,
  type SkillStatRow,
} from '../../types/drill';

export interface SkillStats {
  rows: SkillStatRow[];
  /** Attempts whose question is no longer in the bank, so its skill is unknown. */
  unattributed: number;
}

/** Every attempt counts, including repeats of the same question. Sorted weakest (lowest accuracy) first. */
export function computeSkillStats(attempts: readonly Attempt[], facets: readonly QuestionFacet[]): SkillStats {
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

/** Summary of the questions answered so far in a session, in the order they were asked. */
export function summarizeSession(
  session: SessionRecord,
  displayInfo: ReadonlyMap<string, { displayId: string; skill: string }>,
): SessionSummary {
  const items = session.queueIds.flatMap((id) => {
    const a = session.answered[id];
    if (!a) return [];
    const info = displayInfo.get(id);
    return [{ questionId: id, displayId: info?.displayId ?? id, skill: info?.skill ?? '', correct: a.correct, timeMs: a.timeMs }];
  });
  return {
    total: items.length,
    correct: items.filter((i) => i.correct).length,
    totalTimeMs: items.reduce((s, i) => s + i.timeMs, 0),
    items,
  };
}
