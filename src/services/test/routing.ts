// Routing after module 1: a difficulty-weighted share correct against a threshold from the config.
// Pure. The thresholds are assumptions (docs/scoring-spec.md); every decision is stored with the
// config version it used.

import { ROUTING_THRESHOLD, SCORING_CONFIG_VERSION } from '../../config/scoringConfig';
import type { Section } from '../../types/sat';
import type { RoutingDecision, Route } from '../../types/test';

export interface RoutingItem {
  /** Weight from itemWeight(). */
  weight: number;
  correct: boolean;
}

/** Weighted share correct, 0 to 1. Unanswered questions count as wrong. Empty input gives 0. */
export function weightedFraction(items: readonly RoutingItem[]): number {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return 0;
  return items.reduce((s, i) => s + (i.correct ? i.weight : 0), 0) / total;
}

/** At or above the threshold goes to the harder module 2. */
export function routeFor(fraction: number, threshold: number = ROUTING_THRESHOLD): Route {
  return fraction >= threshold ? 'harder' : 'easier';
}

export function decideRoute(section: Section, items: readonly RoutingItem[], now: number, threshold: number = ROUTING_THRESHOLD): RoutingDecision {
  const f = weightedFraction(items);
  return {
    section,
    weightedFraction: f,
    threshold,
    correct: items.filter((i) => i.correct).length,
    total: items.length,
    route: routeFor(f, threshold),
    configVersion: SCORING_CONFIG_VERSION,
    at: now,
  };
}
