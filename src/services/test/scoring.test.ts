import { describe, expect, it } from 'vitest';
import { EASIER_ROUTE_CAP, ROUTING_THRESHOLD, SCORING_CONFIG_VERSION } from '../../config/scoringConfig';
import { estimateSection, estimateTest, type EstimateItem } from './estimate';
import { decideRoute, routeFor, weightedFraction } from './routing';
import { itemWeight } from './weights';

const item = (weight: number, correct: boolean, answered = true): EstimateItem => ({ weight, correct, answered: answered || correct });
const mod = (n: number, weight: number, rightCount: number): EstimateItem[] => Array.from({ length: n }, (_, i) => item(weight, i < rightCount));

describe('itemWeight', () => {
  it('uses the band, and the difficulty label when the band is unusable', () => {
    expect(itemWeight(7, 'H')).toBeGreaterThan(itemWeight(1, 'E'));
    expect(itemWeight(null, 'H')).toBe(itemWeight(undefined, 'H'));
    expect(itemWeight(99, 'E')).toBe(itemWeight(null, 'E'));
    expect(itemWeight(2.5, 'M')).toBe(itemWeight(null, 'M'));
  });
});

describe('routing', () => {
  it('all wrong goes easier, all right goes harder', () => {
    expect(routeFor(weightedFraction(mod(10, 2, 0)))).toBe('easier');
    expect(routeFor(weightedFraction(mod(10, 2, 10)))).toBe('harder');
    expect(weightedFraction([])).toBe(0);
  });

  it('the boundary: exactly the threshold goes harder, just under goes easier', () => {
    expect(routeFor(ROUTING_THRESHOLD)).toBe('harder');
    expect(routeFor(ROUTING_THRESHOLD - 1e-9)).toBe('easier');
    // 5 of 10 equal-weight questions is exactly 0.5 with the default threshold.
    expect(decideRoute('math', mod(10, 1, 5), 1).route).toBe('harder');
    expect(decideRoute('math', mod(10, 1, 4), 1).route).toBe('easier');
  });

  it('a hard question right counts more than an easy one', () => {
    const easyRight = [{ weight: 1, correct: true }, { weight: 3, correct: false }];
    const hardRight = [{ weight: 1, correct: false }, { weight: 3, correct: true }];
    expect(weightedFraction(hardRight)).toBeGreaterThan(weightedFraction(easyRight));
    expect(routeFor(weightedFraction(hardRight))).toBe('harder');
    expect(routeFor(weightedFraction(easyRight))).toBe('easier');
  });

  it('the decision records its inputs and the config version', () => {
    const d = decideRoute('rw', mod(4, 2, 3), 99);
    expect(d).toMatchObject({ section: 'rw', correct: 3, total: 4, route: 'harder', configVersion: SCORING_CONFIG_VERSION, at: 99 });
  });
});

describe('estimate', () => {
  const full = (route: 'easier' | 'harder', right: number) => ({ section: 'math' as const, route, items: mod(44, 2, right) });

  it('is a range with the midpoint inside it, rounded to 10, within 200 to 800', () => {
    for (const route of ['easier', 'harder'] as const) {
      for (const right of [0, 10, 22, 44]) {
        const e = estimateSection(full(route, right));
        expect(e.low).toBeLessThanOrEqual(e.mid);
        expect(e.mid).toBeLessThanOrEqual(e.high);
        expect(e.low).toBeGreaterThanOrEqual(200);
        expect(e.high).toBeLessThanOrEqual(800);
        expect([e.low, e.mid, e.high].every((n) => n % 10 === 0)).toBe(true);
      }
    }
  });

  it('is monotone in the number right', () => {
    const mids = [0, 11, 22, 33, 44].map((r) => estimateSection(full('harder', r)).mid);
    expect(mids).toEqual([...mids].sort((a, b) => a - b));
    expect(new Set(mids).size).toBe(mids.length);
  });

  it('the easier route never reaches above its cap, and says so when the cap cut the range', () => {
    const e = estimateSection(full('easier', 44));
    expect(e.high).toBeLessThanOrEqual(EASIER_ROUTE_CAP);
    expect(e.capped).toBe(true);
    const low = estimateSection(full('easier', 4));
    expect(low.capped).toBe(false);
  });

  it('the harder route can reach the top of the scale', () => {
    expect(estimateSection(full('harder', 44)).high).toBeGreaterThan(EASIER_ROUTE_CAP);
  });

  it('the range is wider when fewer questions were answered', () => {
    const answeredAll = estimateSection({ section: 'rw', route: 'harder', items: mod(54, 2, 27) });
    const half = estimateSection({ section: 'rw', route: 'harder', items: [...mod(27, 2, 27), ...Array.from({ length: 27 }, () => item(2, false, false))] });
    expect(half.high - half.low).toBeGreaterThan(answeredAll.high - answeredAll.low);
    expect(half.answered).toBe(27);
    expect(half.total).toBe(54);
  });

  it('unanswered counts as wrong and an empty test does not crash', () => {
    const e = estimateSection({ section: 'rw', route: 'easier', items: [] });
    expect(e.weightedFraction).toBe(0);
    expect(e.low).toBe(200);
  });

  it('a total range exists only when both sections were taken, and carries the config version', () => {
    const rw = { section: 'rw' as const, route: 'harder' as const, items: mod(54, 2, 40) };
    const m = { section: 'math' as const, route: 'easier' as const, items: mod(44, 2, 30) };
    const both = estimateTest([rw, m]);
    expect(both.configVersion).toBe(SCORING_CONFIG_VERSION);
    expect(both.total?.low).toBe(both.sections[0]!.low + both.sections[1]!.low);
    expect(both.total?.high).toBe(both.sections[0]!.high + both.sections[1]!.high);
    expect(estimateTest([rw]).total).toBeNull();
  });
});
