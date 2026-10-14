import { describe, expect, it } from 'vitest';
import { MIN_TRUSTED_ATTEMPTS, type Attempt, type DrillConfig, type QuestionFacet, type SessionRecord } from '../../types/drill';
import type { Difficulty, Section } from '../../types/sat';
import { MemoryAttemptStore } from '../storage/attemptsMemory';
import { buildTaxonomy, capCount, matchingCount } from './facets';
import { selectQuestionIds } from './select';
import { computeSkillStats, summarizeSession } from './stats';

// Synthetic facets only: 2 sections x 2 domains x 2 skills x 3 difficulties, every 4th inactive.
function makeFacets(): QuestionFacet[] {
  const out: QuestionFacet[] = [];
  let n = 0;
  for (const section of ['rw', 'math'] as Section[]) {
    for (const d of [1, 2]) {
      for (const s of [1, 2]) {
        for (const difficulty of ['E', 'M', 'H'] as Difficulty[]) {
          for (let k = 0; k < 2; k++) {
            out.push({
              id: `q${n}`,
              section,
              domainCode: `${section}-D${d}`,
              domain: `${section} domain ${d}`,
              skillCode: `${section}-D${d}-S${s}`,
              skill: `${section} skill ${d}.${s}`,
              difficulty,
              active: n % 4 !== 0,
            });
            n++;
          }
        }
      }
    }
  }
  return out;
}

const facets = makeFacets();
const base: DrillConfig = { section: 'math', domainCode: 'all', skillCodes: [], difficulties: [], count: 10, liveOnly: false };

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let attemptSeq = 0;
function attempt(questionId: string, correct: boolean, at: number, extra: Partial<Attempt> = {}): Attempt {
  attemptSeq++;
  return { id: `s:${questionId}:${attemptSeq}`, questionId, response: 'A', correct, timeMs: 1000, sessionId: 's', at, ...extra };
}

describe('facets', () => {
  it('counts by every filter', () => {
    expect(matchingCount(facets, base)).toBe(24);
    expect(matchingCount(facets, { ...base, domainCode: 'math-D1' })).toBe(12);
    expect(matchingCount(facets, { ...base, skillCodes: ['math-D1-S1', 'math-D2-S2'] })).toBe(12);
    expect(matchingCount(facets, { ...base, difficulties: ['E'] })).toBe(8);
    expect(matchingCount(facets, { ...base, difficulties: ['E', 'H'] })).toBe(16);
    const live = matchingCount(facets, { ...base, liveOnly: true });
    expect(live).toBe(facets.filter((f) => f.section === 'math' && f.active).length);
    expect(live).toBeLessThan(24);
  });

  it('caps the count and never pads', () => {
    expect(capCount(facets, { ...base, domainCode: 'math-D1', skillCodes: ['math-D1-S1'], difficulties: ['E'], count: 50 }).count).toBe(2);
    expect(capCount(facets, { ...base, count: 5 }).count).toBe(5);
    expect(capCount(facets, { ...base, skillCodes: ['nope'], count: 5 }).count).toBe(0);
  });

  it('builds a sorted taxonomy', () => {
    const t = buildTaxonomy(facets);
    expect(t.map((s) => s.section)).toEqual(['rw', 'math']);
    expect(t[0]?.domains).toHaveLength(2);
    expect(t[0]?.domains[0]?.skills).toHaveLength(2);
    expect(t[0]?.domains[0]?.skills[0]?.total).toBe(6);
    expect(buildTaxonomy([])).toEqual([]);
  });
});

describe('selectQuestionIds', () => {
  it('returns unique ids that all match the config', () => {
    const cfg = { ...base, count: 20, difficulties: ['M' as const] };
    const ids = selectQuestionIds(facets, cfg, [], seeded(1));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(8);
    const byId = new Map(facets.map((f) => [f.id, f]));
    for (const id of ids) expect(byId.get(id)?.difficulty).toBe('M');
  });

  it('returns fewer than requested when fewer match, never padding', () => {
    expect(selectQuestionIds(facets, { ...base, skillCodes: ['math-D1-S1'], count: 50 }, [], seeded(2))).toHaveLength(6);
    expect(selectQuestionIds(facets, { ...base, count: 0 }, [], seeded(2))).toEqual([]);
  });

  it('prefers unseen, then wrong (oldest first), then right (oldest first)', () => {
    const mathIds = facets.filter((f) => f.section === 'math').map((f) => f.id);
    const [a, b, c, d, e, ...unseen] = mathIds as [string, string, string, string, string, ...string[]];
    const attempts = [
      attempt(a, true, 100),
      attempt(b, false, 300),
      attempt(c, false, 200),
      attempt(d, true, 50),
      // e: wrong long ago, then right: latest attempt counts, so it is a "right" question
      attempt(e, false, 10),
      attempt(e, true, 400),
    ];
    const ids = selectQuestionIds(facets, { ...base, count: 24 }, attempts, seeded(3));
    expect(ids).toHaveLength(24);
    expect(new Set(ids.slice(0, unseen.length))).toEqual(new Set(unseen));
    expect(ids.slice(unseen.length)).toEqual([c, b, d, a, e]);
  });

  it('is deterministic for a given rng and varies across rngs', () => {
    const x = selectQuestionIds(facets, base, [], seeded(7));
    const y = selectQuestionIds(facets, base, [], seeded(7));
    const z = selectQuestionIds(facets, base, [], seeded(8));
    expect(x).toEqual(y);
    expect(x).not.toEqual(z);
  });
});

describe('computeSkillStats', () => {
  it('cross-checks against a brute-force count over random attempts', () => {
    const rng = seeded(42);
    const attempts: Attempt[] = [];
    for (let i = 0; i < 500; i++) {
      const f = facets[Math.floor(rng() * facets.length)] as QuestionFacet;
      attempts.push(attempt(f.id, rng() < 0.6, i, { timeMs: Math.floor(rng() * 90000) }));
    }
    const { rows, unattributed } = computeSkillStats(attempts, facets);
    expect(unattributed).toBe(0);

    const byId = new Map(facets.map((f) => [f.id, f]));
    let totalAttempts = 0;
    for (const row of rows) {
      const mine = attempts.filter((a) => byId.get(a.questionId)?.skillCode === row.skillCode);
      const correct = mine.filter((a) => a.correct).length;
      expect(row.attempts).toBe(mine.length);
      expect(row.correct).toBe(correct);
      expect(row.accuracy).toBeCloseTo(correct / mine.length, 12);
      expect(row.avgTimeMs).toBeCloseTo(mine.reduce((s, a) => s + a.timeMs, 0) / mine.length, 6);
      expect(row.lowData).toBe(mine.length < MIN_TRUSTED_ATTEMPTS);
      totalAttempts += row.attempts;
    }
    expect(totalAttempts).toBe(500);
    for (let i = 1; i < rows.length; i++) {
      expect((rows[i - 1] as { accuracy: number }).accuracy).toBeLessThanOrEqual((rows[i] as { accuracy: number }).accuracy);
    }
  });

  it('counts attempts on questions missing from the bank separately', () => {
    const { rows, unattributed } = computeSkillStats([attempt('gone', true, 1), attempt('q1', true, 2)], facets);
    expect(unattributed).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lowData).toBe(true);
  });

  it('returns no rows for no attempts', () => {
    expect(computeSkillStats([], facets)).toEqual({ rows: [], unattributed: 0 });
  });
});

describe('summarizeSession', () => {
  const session: SessionRecord = {
    id: 's',
    config: base,
    queueIds: ['q1', 'q2', 'q3'],
    index: 2,
    startedAt: 0,
    status: 'active',
    answered: {
      q1: { response: 'A', correct: true, timeMs: 1000, at: 1 },
      q2: { response: 'B', correct: false, timeMs: 3000, at: 2 },
    },
    struck: {},
    currentElapsedMs: 0,
  };

  it('summarizes answered questions in queue order', () => {
    const info = new Map([['q1', { displayId: 'x1', skill: 'k1' }], ['q2', { displayId: 'x2', skill: 'k2' }]]);
    const s = summarizeSession(session, info);
    expect(s.total).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.totalTimeMs).toBe(4000);
    expect(s.items.map((i) => i.displayId)).toEqual(['x1', 'x2']);
  });
});

describe('MemoryAttemptStore', () => {
  it('keeps attempts independent of any question bank and is idempotent on id', async () => {
    const store = new MemoryAttemptStore();
    const a = attempt('q1', true, 1, { id: 'fixed' });
    await store.addAttempt(a);
    await store.addAttempt({ ...a, correct: false });
    const all = await store.listAttempts();
    expect(all).toHaveLength(1);
    expect(all[0]?.correct).toBe(false);
    expect(await store.attemptsForSession('s')).toHaveLength(1);
    expect(await store.attemptsForSession('other')).toHaveLength(0);
  });

  it('stores flags and returns only the newest active session', async () => {
    const store = new MemoryAttemptStore();
    await store.setFlag('q1', true);
    await store.setFlag('q2', true);
    await store.setFlag('q1', false);
    expect((await store.listFlags()).map((f) => f.questionId)).toEqual(['q2']);

    const mk = (id: string, startedAt: number, status: SessionRecord['status']): SessionRecord => ({
      id, config: base, queueIds: [], index: 0, startedAt, status, answered: {}, struck: {}, currentElapsedMs: 0,
    });
    await store.saveSession(mk('old', 1, 'active'));
    await store.saveSession(mk('new', 2, 'active'));
    await store.saveSession(mk('done', 3, 'finished'));
    expect((await store.getActiveSession())?.id).toBe('new');
    await store.deleteSession('new');
    expect((await store.getActiveSession())?.id).toBe('old');
    await store.clearAll();
    expect(await store.getActiveSession()).toBeNull();
    expect(await store.listAttempts()).toEqual([]);
  });
});
