// Insight inputs from analytics summaries and user records, shared by the AI report, the AI coach
// and the dashboard so all three see the same numbers. Pure.

import type { AnalyticsFilter, BehaviorSummary, MissRow, OverviewSummary, SkillsSummary, TimingSummary } from '../../types/analytics';
import type { MistakeReason, MistakeTag } from '../../types/mistakes';
import type { SessionRecord, StoredAttempt } from '../../types/session';
import { latestTags } from '../mistakes/mistakes';
import { deriveRetryQueue, dueQuestionIds, retryAccuracy } from '../retry/queue';
import type { InsightInputs } from './insights';

export interface InsightSources {
  filter: AnalyticsFilter;
  before: AnalyticsFilter | null;
  period: InsightInputs['period'];
  overview: OverviewSummary;
  skills: SkillsSummary;
  timing: TimingSummary;
  behavior: BehaviorSummary;
  misses: readonly MissRow[];
  tags: readonly MistakeTag[];
  /** Hidden session ids (expanded to test modules), empty when the filter counts hidden sessions. */
  hidden: ReadonlySet<string>;
  /** Questions still in the bank. */
  inBank: (questionId: string) => boolean;
  attempts: readonly StoredAttempt[];
  sessions: readonly SessionRecord[];
  now: number;
}

/** The retry queue state. The queue ignores the hidden flag on purpose: you did see those questions. */
export function retryFigures(attempts: readonly StoredAttempt[], sessions: readonly SessionRecord[], now: number) {
  const queue = deriveRetryQueue(attempts, sessions, now);
  const acc = retryAccuracy(attempts, sessions);
  return { answered: acc.answered, correct: acc.correct, due: dueQuestionIds(queue).length, queued: queue.length };
}

export function insightInputsFrom(x: InsightSources): InsightInputs {
  const inRange = (at: number, a: number | null, b: number | null) => (a === null || at >= a) && (b === null || at <= b);
  const inForce = [...latestTags(x.tags).values()];
  const reasons = (a: number | null, b: number | null) => {
    const m: Partial<Record<MistakeReason, number>> = {};
    for (const t of inForce) if (inRange(t.at, a, b) && x.inBank(t.questionId) && !x.hidden.has(t.sessionId)) m[t.reason] = (m[t.reason] ?? 0) + 1;
    return m;
  };
  const o = x.overview.attempts;
  const ch = x.behavior.counts;
  return {
    period: x.period,
    answered: o.drill.attempts + o.exam.attempts,
    correct: o.drill.correct + o.exam.correct,
    skills: x.skills.rows,
    misses: x.misses,
    rushedWrong: x.timing.flaggedCounts.rushedWrong.drill + x.timing.flaggedCounts.rushedWrong.exam,
    stuck: x.timing.flaggedCounts.stuck.drill + x.timing.flaggedCounts.stuck.exam,
    reasons: reasons(x.filter.from, x.filter.to),
    reasonsBefore: x.before ? reasons(x.before.from, x.before.to) : null,
    lastFive: {
      modules: x.timing.modules.length,
      reached: x.timing.modules.filter((m) => m.reachedFiveMinutes).length,
      answeredInLastFive: x.timing.modules.reduce((s, m) => s + m.answeredInLastFive, 0),
    },
    changes: {
      correctToIncorrect: ch.drill.correctToIncorrect + ch.exam.correctToIncorrect,
      incorrectToCorrect: ch.drill.incorrectToCorrect + ch.exam.incorrectToCorrect,
      incorrectToIncorrect: ch.drill.incorrectToIncorrect + ch.exam.incorrectToIncorrect,
    },
    retry: retryFigures(x.attempts, x.sessions, x.now),
  };
}
