// Pool health: how many more tests of each kind can still be assembled. It simulates assembly
// against the real difficulty profiles instead of dividing totals, so a thin hard pool shows up.
// An estimate: real assembly is random, and the route (easier or harder Module 2) is not known in
// advance, so each simulated test uses up Module 1 plus the harder Module 2 (the larger draw on hard questions).

import type { BrowseRow } from '../../types/browse';
import type { Section } from '../../types/sat';
import type { EligibilityPolicy } from '../eligibility/eligibility';
import type { Rng } from '../exam/assemble';
import { buildSection } from './preflight';

/** Stops counting here; the screen says "50 or more". */
export const POOL_HEALTH_CAP = 50;

export interface PoolHealth {
  rw: number;
  math: number;
  /** A full test needs both sections, so it is the smaller of the two. */
  full: number;
  /** True when a count hit the cap. */
  capped: boolean;
}

export function simulateSectionTests(rows: readonly BrowseRow[], section: Section, policy: EligibilityPolicy, rng: Rng, cap = POOL_HEALTH_CAP): number {
  const used = new Set<string>();
  let n = 0;
  while (n < cap) {
    const b = buildSection(rows, section, rng, policy, used);
    if (!b.complete || b.lines.length > 0) break;
    for (const id of [...b.module1, ...b.harder]) used.add(id);
    n++;
  }
  return n;
}

/** Tests that can still be assembled under `policy`. Deterministic for a given `rng`. */
export function poolHealth(rows: readonly BrowseRow[], policy: EligibilityPolicy, rng: Rng = Math.random): PoolHealth {
  const live = rows.filter((r) => r.active);
  const rw = simulateSectionTests(live, 'rw', policy, rng);
  const math = simulateSectionTests(live, 'math', policy, rng);
  return { rw, math, full: Math.min(rw, math), capped: rw >= POOL_HEALTH_CAP || math >= POOL_HEALTH_CAP };
}
