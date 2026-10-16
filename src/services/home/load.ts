// Loads what Home shows: the status line, the Up next choice and the pool line. UI calls this and
// renders the result (AGENTS.md rule 6).

import { drillStore } from '../../stores/drillStore';
import { hiddenSessionIds } from '../analytics/hidden';
import { loadFacets } from '../drill/facetCache';
import { countableAttempts } from '../drill/stats';
import { loadPoolHealth, type PoolHealthView } from '../retry/load';
import { deriveRetryQueue, dueQuestionIds } from '../retry/queue';
import { inProgressRows } from '../session/report';
import { attemptStore, hiddenSessionsStore, questionStore } from '../storage';
import { countRankableSkills, pickUpNext, type UpNextChoice } from './upNext';

export interface HomeState {
  questions: number;
  done: number;
  upNext: UpNextChoice;
  poolLine: string | null;
}

export function poolLineFor(h: PoolHealthView | null): string | null {
  if (!h) return null;
  const n = h.fresh.full;
  if (n === 0) return 'Not enough fresh questions for a full test (estimate)';
  return `Fresh questions for about ${h.fresh.capped && n >= 50 ? '50 or more' : n} full ${n === 1 ? 'test' : 'tests'} (estimate)`;
}

export async function loadHomeState(questions: number, now: number = Date.now()): Promise<HomeState> {
  const [sessions, attempts, status, hidden, facets, health] = await Promise.all([
    attemptStore.listSessions(),
    attemptStore.listAttempts(),
    attemptStore.questionStatus(),
    hiddenSessionsStore.listHidden().catch(() => []),
    loadFacets(questionStore).catch(() => []),
    loadPoolHealth().catch(() => null),
    drillStore.getState().init(),
  ]);
  const hiddenIds = hiddenSessionIds(sessions, hidden);
  const first = [...countableAttempts(attempts, sessions, 'drill'), ...countableAttempts(attempts, sessions, 'exam')].filter((a) => !hiddenIds.has(a.sessionId));
  const skillOf = new Map(facets.map((f) => [f.id, f.skillCode]));
  const sectionOf = new Map(facets.map((f) => [f.id, f.section]));
  const queue = deriveRetryQueue(attempts, sessions, now);
  const upNext = pickUpNext({
    inProgress: inProgressRows(drillStore.getState().inProgress, facets),
    retryDue: dueQuestionIds(queue).length,
    rankableSkills: countRankableSkills(first, skillOf),
    starterSection: first.filter((a) => sectionOf.get(a.questionId) === 'math').length < first.filter((a) => sectionOf.get(a.questionId) === 'rw').length ? 'math' : 'rw',
  });
  return { questions, done: status.filter((s) => s.done).length, upNext, poolLine: poolLineFor(health) };
}
