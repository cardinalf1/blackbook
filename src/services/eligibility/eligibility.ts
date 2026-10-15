// The one definition of "which questions may go into a full test or section test". Assembly,
// preflight, pool health and the Browse markers all call this file; nothing re-implements the rule.
// Pure and derived: it reads each row's status (itself derived from attempts, sessions and events)
// and stores nothing of its own.
//
// - consumed: the question has a final answer in any session (drill, Browse single, retry, exam), or
//   it was shown in any exam module, including paused or discarded exams and questions never answered.
//   Never used in a test unless the user explicitly allows repeats.
// - soft: shown in a drill or Browse but never answered. Used only when the fresh pool is short, and
//   only after the user confirms.
// - fresh: never shown anywhere.
// A question inside an unfinished session counts as seen, not done, until it has a final answer.

import type { BrowseRow } from '../../types/browse';

export type PoolTier = 'fresh' | 'soft' | 'consumed';

export interface EligibilityPolicy {
  /** Allow seen-but-never-answered questions (drills, Browse). */
  allowSoft: boolean;
  /** Allow consumed questions. A test built this way is labeled "contains repeats". */
  allowRepeats: boolean;
}

export const STRICT_POLICY: EligibilityPolicy = { allowSoft: false, allowRepeats: false };

type Facts = Pick<BrowseRow, 'status' | 'examShown'>;

export function tierOf(row: Facts): PoolTier {
  if (row.status === 'done' || row.examShown) return 'consumed';
  return row.status === 'seen' ? 'soft' : 'fresh';
}

export const TIER_ORDER: Record<PoolTier, number> = { fresh: 0, soft: 1, consumed: 2 };

export function tierAllowed(tier: PoolTier, policy: EligibilityPolicy): boolean {
  return tier === 'fresh' || (tier === 'soft' && (policy.allowSoft || policy.allowRepeats)) || (tier === 'consumed' && policy.allowRepeats);
}

export function isEligible(row: Facts, policy: EligibilityPolicy): boolean {
  return tierAllowed(tierOf(row), policy);
}

/** Live rows a test may draw from under `policy`. */
export function eligibleRows(rows: readonly BrowseRow[], policy: EligibilityPolicy): BrowseRow[] {
  return rows.filter((r) => r.active && isEligible(r, policy));
}

/** Live rows per tier, by section and difficulty. The script and Browse use it to show counts. */
export interface TierCounts {
  fresh: number;
  soft: number;
  consumed: number;
}

export function countTiers(rows: readonly BrowseRow[]): TierCounts {
  const out: TierCounts = { fresh: 0, soft: 0, consumed: 0 };
  for (const r of rows) if (r.active) out[tierOf(r)]++;
  return out;
}
