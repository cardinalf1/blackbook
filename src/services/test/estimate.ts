// The score estimate: a range, never a single exact score (AGENTS.md rule 5). A pure function of
// the answers, the difficulty of each question and the route. No IRT and no invented item
// parameters: the weighted share correct is mapped linearly onto a score band that depends on the
// route, and the range widens when the data is thin. All numbers are in scoringConfig.ts and are
// assumptions (docs/scoring-spec.md).

import {
  BASE_HALF_WIDTH,
  EASIER_ROUTE_CAP,
  EASIER_ROUTE_EXTRA_HALF_WIDTH,
  HARDER_ROUTE_FLOOR,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_STEP,
  SCORING_CONFIG_VERSION,
  UNANSWERED_HALF_WIDTH,
} from '../../config/scoringConfig';
import type { Section } from '../../types/sat';
import type { Route, ScoreEstimate, SectionEstimate } from '../../types/test';

export interface EstimateItem {
  weight: number;
  correct: boolean;
  answered: boolean;
}

export interface SectionEstimateInput {
  section: Section;
  route: Route;
  /** Every question of both modules of the section. */
  items: readonly EstimateItem[];
}

const roundStep = (n: number) => Math.round(n / SCORE_STEP) * SCORE_STEP;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function estimateSection(input: SectionEstimateInput): SectionEstimate {
  const { section, route, items } = input;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const fraction = totalWeight > 0 ? items.reduce((s, i) => s + (i.correct ? i.weight : 0), 0) / totalWeight : 0;
  const answered = items.filter((i) => i.answered).length;
  const total = items.length;
  const unansweredShare = total > 0 ? (total - answered) / total : 1;

  const bottom = route === 'harder' ? HARDER_ROUTE_FLOOR : SCORE_MIN;
  const top = route === 'harder' ? SCORE_MAX : EASIER_ROUTE_CAP;
  const mid = bottom + (top - bottom) * fraction;

  const half = BASE_HALF_WIDTH + UNANSWERED_HALF_WIDTH * unansweredShare + (route === 'easier' ? EASIER_ROUTE_EXTRA_HALF_WIDTH : 0);
  const rawHigh = mid + half;
  const high = roundStep(clamp(rawHigh, SCORE_MIN, top));
  const low = roundStep(clamp(mid - half, SCORE_MIN, SCORE_MAX));
  return {
    section,
    route,
    weightedFraction: fraction,
    low: Math.min(low, high),
    high,
    mid: roundStep(clamp(mid, SCORE_MIN, top)),
    capped: route === 'easier' && rawHigh > EASIER_ROUTE_CAP,
    answered,
    total,
  };
}

/** Section estimates plus a total range when both sections are present. */
export function estimateTest(inputs: readonly SectionEstimateInput[]): ScoreEstimate {
  const sections = inputs.map(estimateSection);
  const both = sections.some((s) => s.section === 'rw') && sections.some((s) => s.section === 'math');
  return {
    configVersion: SCORING_CONFIG_VERSION,
    sections,
    total: both
      ? {
          low: sections.reduce((s, e) => s + e.low, 0),
          high: sections.reduce((s, e) => s + e.high, 0),
          mid: sections.reduce((s, e) => s + e.mid, 0),
        }
      : null,
  };
}
