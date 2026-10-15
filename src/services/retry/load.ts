// Loads the retry queue and pool health from the stores. UI calls these and renders the result.

import { STRICT_POLICY } from '../eligibility/eligibility';
import { loadRows } from '../browse/rows';
import { loadFacets } from '../drill/facetCache';
import { drillStore } from '../../stores/drillStore';
import { attemptStore, questionStore } from '../storage';
import { poolHealth, type PoolHealth } from '../test/pool';
import { deriveRetryQueue, dueQuestionIds, retryAccuracy, type RetryAccuracy, type RetryEntry } from './queue';

export interface RetryState {
  queue: RetryEntry[];
  dueCount: number;
  /** Retry results, kept apart from first-attempt accuracy. */
  accuracy: RetryAccuracy;
}

export async function loadRetryState(now: number = Date.now()): Promise<RetryState> {
  const [attempts, sessions] = await Promise.all([attemptStore.listAttempts(), attemptStore.listSessions()]);
  const queue = deriveRetryQueue(attempts, sessions, now);
  return { queue, dueCount: dueQuestionIds(queue).length, accuracy: retryAccuracy(attempts, sessions) };
}

/** Starts a retry session from what is due now. Resolves after the drill store has the session (or an error). */
export async function startRetryNow(now: number = Date.now()): Promise<void> {
  const [state, facets] = await Promise.all([loadRetryState(now), loadFacets(questionStore)]);
  await drillStore.getState().startRetry(dueQuestionIds(state.queue), facets);
}

export interface PoolHealthView {
  /** Tests that can still be built from questions never shown anywhere. */
  fresh: PoolHealth;
  /** Same once seen-but-never-answered questions are allowed too. */
  withSeen: PoolHealth;
}

/** Simulates assembly against the real difficulty profiles. An estimate. */
export async function loadPoolHealth(): Promise<PoolHealthView> {
  const rows = await loadRows();
  return {
    fresh: poolHealth(rows, STRICT_POLICY),
    withSeen: poolHealth(rows, { allowSoft: true, allowRepeats: false }),
  };
}
