// Picks the questions for a drill session. Pure: attempts and randomness come in as arguments.

import type { DrillConfig, QuestionFacet } from '../../types/drill';
import type { StoredAttempt } from '../../types/session';
import { matchingFacets } from './facets';

export type Rng = () => number;

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/**
 * Order of preference: questions never attempted (random order), then questions whose latest
 * attempt was wrong (the one answered longest ago first), then questions whose latest attempt was
 * right (the one answered longest ago first). Ids are unique, so nothing repeats in a session.
 * Returns at most `config.count` ids; fewer if fewer match. It never pads.
 */
export function selectQuestionIds(
  facets: readonly QuestionFacet[],
  config: DrillConfig,
  attempts: readonly StoredAttempt[],
  rng: Rng = Math.random,
): string[] {
  // A pinned list (the Study next review of misses) is served as given: no filters, no shuffling.
  if (config.questionIds) {
    const known = new Set(facets.map((f) => f.id));
    return [...new Set(config.questionIds)].filter((id) => known.has(id)).slice(0, Math.max(0, config.count));
  }
  const latest = new Map<string, StoredAttempt>();
  for (const a of attempts) {
    const prev = latest.get(a.questionId);
    if (!prev || a.at > prev.at) latest.set(a.questionId, a);
  }

  const unseen: string[] = [];
  const wrong: StoredAttempt[] = [];
  const right: StoredAttempt[] = [];
  for (const f of matchingFacets(facets, config)) {
    const last = latest.get(f.id);
    if (!last) unseen.push(f.id);
    else (last.correct ? right : wrong).push(last);
  }

  // Equal timestamps are shuffled first so the (stable) sort leaves their order random.
  const byAge = (list: StoredAttempt[]) => shuffle(list, rng).sort((a, b) => a.at - b.at).map((a) => a.questionId);
  return [...shuffle(unseen, rng), ...byAge(wrong), ...byAge(right)].slice(0, Math.max(0, config.count));
}
