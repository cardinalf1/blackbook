// The SQL analytics must agree exactly with the brute-force recomputation on a synthetic dataset,
// for every summary and a spread of filters. Synthetic data only.

import { describe, expect, it } from 'vitest';
import { bruteBehavior, bruteMisses, bruteOverview, bruteSkillDetail, bruteSkills, bruteTests, bruteTiming, type RawData } from '../src/services/analytics/brute';
import { synthData } from '../src/services/analytics/synth';
import { ANALYTICS_KINDS, DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter } from '../src/types/analytics';
import { loadInto } from './testSupport';

function filters(raw: RawData): AnalyticsFilter[] {
  const times = raw.sessions.map((s) => s.finishedAt ?? s.lastActivityAt).sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)] as number;
  const base = DEFAULT_ANALYTICS_FILTER;
  return [
    base,
    ...ANALYTICS_KINDS.map((kind) => ({ ...base, kind })),
    { ...base, section: 'rw' },
    { ...base, section: 'math', kind: 'drill' },
    { ...base, excludePaused: true },
    { ...base, excludeSingle: true },
    { ...base, from: mid },
    { ...base, to: mid, excludePaused: true, excludeSingle: true },
    { ...base, from: mid - 20 * 86_400_000, to: mid + 20 * 86_400_000, section: 'math' },
  ];
}

describe('SQL analytics agree with the brute-force recomputation', () => {
  const raw = synthData({ seed: 7, attempts: 1500, events: 30_000, orphanQuestions: 4 });

  it('the synthetic data has the variety the checks need', () => {
    expect(raw.attempts.length).toBeGreaterThan(1500);
    expect(raw.events.length).toBeGreaterThan(20_000);
    expect(raw.sessions.some((s) => s.test?.paused)).toBe(true);
    expect(raw.sessions.some((s) => s.status === 'abandoned')).toBe(true);
    expect(raw.sessions.some((s) => s.source === 'browse')).toBe(true);
    expect(raw.sessions.some((s) => s.test && s.test.estimate?.configVersion === 2)).toBe(true);
  });

  it('matches for every summary and filter', async () => {
    const { analytics } = await loadInto(raw);
    for (const f of filters(raw)) {
      const label = JSON.stringify(f);
      expect(await analytics.overview(f), `overview ${label}`).toEqual(bruteOverview(raw, f));
      expect(await analytics.skills(f), `skills ${label}`).toEqual(bruteSkills(raw, f));
      expect(await analytics.misses(f), `misses ${label}`).toEqual(bruteMisses(raw, f));
      expect(await analytics.timing(f), `timing ${label}`).toEqual(bruteTiming(raw, f));
      expect(await analytics.behavior(f), `behavior ${label}`).toEqual(bruteBehavior(raw, f));
      expect(await analytics.tests(f), `tests ${label}`).toEqual(bruteTests(raw, f));
    }
  }, 120_000);

  it('matches for one skill and for limited misses', async () => {
    const { analytics } = await loadInto(raw);
    const f = DEFAULT_ANALYTICS_FILTER;
    const skill = (await analytics.skills(f)).rows.find((r) => r.counts.drill.attempts > 20);
    expect(skill).toBeDefined();
    const code = (skill as NonNullable<typeof skill>).skillCode;
    expect(await analytics.skillDetail(f, code)).toEqual(bruteSkillDetail(raw, f, code));
    expect(await analytics.misses(f, { section: 'math' })).toEqual(bruteMisses(raw, f, { section: 'math' }));
    expect(await analytics.misses(f, { skillCodes: [code] })).toEqual(bruteMisses(raw, f, { skillCodes: [code] }));
  });

  it('excludes unfinished sessions, drafts, containers and answers with no bank question', async () => {
    const { analytics } = await loadInto(raw);
    const o = await analytics.overview(DEFAULT_ANALYTICS_FILTER);
    const finished = raw.sessions.filter((s) => s.status === 'finished' && !s.test);
    expect(o.sessions.drill + o.sessions.exam).toBe(finished.length);
    const known = new Set(raw.questions.map((q) => q.id));
    const finishedIds = new Set(finished.map((s) => s.id));
    const countable = raw.attempts.filter((a) => a.status === 'final' && a.response !== '' && finishedIds.has(a.sessionId));
    expect(o.attempts.drill.attempts + o.attempts.exam.attempts).toBe(countable.filter((a) => known.has(a.questionId)).length);
    expect(o.unattributed).toBe(countable.filter((a) => !known.has(a.questionId)).length);
  });

  it('flags rushed-wrong and stuck answers only against a usable baseline', async () => {
    const { analytics } = await loadInto(raw);
    const t = await analytics.timing(DEFAULT_ANALYTICS_FILTER);
    expect(t.flagged.length).toBeGreaterThan(0);
    const usable = new Set(t.baselines.filter((b) => b.usable).map((b) => `${b.mode}|${b.section}|${b.difficulty}`));
    const byQ = new Map(raw.questions.map((q) => [q.id, q]));
    for (const x of t.flagged) {
      const q = byQ.get(x.questionId) as NonNullable<ReturnType<typeof byQ.get>>;
      expect(usable.has(`${x.mode}|${q.section}|${q.difficulty}`)).toBe(true);
      if (x.flag === 'rushed_wrong') {
        expect(x.correct).toBe(false);
        expect(x.timeMs).toBeLessThan(x.thresholdMs);
      } else expect(x.timeMs).toBeGreaterThan(x.thresholdMs);
    }
    // Drill and exam timing never share a baseline.
    expect(t.baselines.some((b) => b.mode === 'drill')).toBe(true);
    expect(t.baselines.some((b) => b.mode === 'exam')).toBe(true);
  });
});
