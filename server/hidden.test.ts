// Hiding sessions from analytics (Phase 8). Both halves of the rule:
//   1. Hidden sessions leave the dashboard and analytics (SQL and the brute-force checker agree).
//   2. They still count as seen and done for the exam no-repeat rule, the retry queue and pool health.
// Synthetic data only.

import { describe, expect, it } from 'vitest';
import { bruteBehavior, bruteMisses, bruteOverview, bruteSkills, bruteTests, bruteTiming, type RawData } from '../src/services/analytics/brute';
import { synthData } from '../src/services/analytics/synth';
import { buildRows } from '../src/services/browse/filter';
import { STRICT_POLICY, tierOf } from '../src/services/eligibility/eligibility';
import { deriveRetryQueue } from '../src/services/retry/queue';
import { poolHealth } from '../src/services/test/pool';
import { DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter } from '../src/types/analytics';
import { loadInto } from './testSupport';

const fixedRng = () => {
  let x = 42;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
};

describe('hidden sessions', () => {
  const raw = synthData({ seed: 5, attempts: 900, events: 6000, orphanQuestions: 2, hideEvery: 3 });
  const hidden = raw.hidden ?? [];
  const shown: RawData = { ...raw, hidden: [] };

  async function load() {
    const out = await loadInto(raw);
    await out.store.setHidden(hidden, true);
    return out;
  }

  it('the synthetic set hides drills, exam modules and a whole test', () => {
    const byId = new Map(raw.sessions.map((s) => [s.id, s]));
    expect(hidden.length).toBeGreaterThanOrEqual(5);
    expect(hidden.some((id) => byId.get(id)?.test)).toBe(true);
    expect(hidden.some((id) => byId.get(id)?.mode === 'drill')).toBe(true);
  });

  it('SQL and brute force agree with hidden sessions left out, and with them counted', async () => {
    const { analytics } = await load();
    const filters: AnalyticsFilter[] = [DEFAULT_ANALYTICS_FILTER, { ...DEFAULT_ANALYTICS_FILTER, includeHidden: true }, { ...DEFAULT_ANALYTICS_FILTER, section: 'math' }];
    for (const f of filters) {
      expect(await analytics.overview(f)).toEqual(bruteOverview(raw, f));
      expect(await analytics.skills(f)).toEqual(bruteSkills(raw, f));
      expect(await analytics.misses(f)).toEqual(bruteMisses(raw, f));
      expect(await analytics.timing(f)).toEqual(bruteTiming(raw, f));
      expect(await analytics.behavior(f)).toEqual(bruteBehavior(raw, f));
      expect(await analytics.tests(f)).toEqual(bruteTests(raw, f));
    }
  }, 60_000);

  it('hiding removes the sessions from analytics, and showing them again restores the numbers', async () => {
    const { analytics, store } = await load();
    const f = DEFAULT_ANALYTICS_FILTER;
    const without = await analytics.overview(f);
    const all = bruteOverview(shown, f);
    expect(without.sessions.drill + without.sessions.exam).toBeLessThan(all.sessions.drill + all.sessions.exam);
    expect(await analytics.overview({ ...f, includeHidden: true })).toEqual(all);
    const hiddenTest = raw.sessions.find((s) => s.test && hidden.includes(s.id));
    expect((await analytics.tests(f)).tests.some((t) => t.testId === hiddenTest?.id)).toBe(false);

    await store.setHidden(hidden, false);
    expect(await analytics.overview(f)).toEqual(all);
    expect(await store.listHidden()).toEqual([]);
  }, 30_000);

  it('still counts hidden sessions for no-repeat, retries and pool health', async () => {
    const { store } = await loadInto(raw);
    const before = {
      status: await store.questionStatus(),
      queue: deriveRetryQueue(await store.listAttempts(), await store.listSessions(), Date.UTC(2026, 9, 1)),
    };
    await store.setHidden(hidden, true);
    const status = await store.questionStatus();
    expect(status).toEqual(before.status);
    expect(deriveRetryQueue(await store.listAttempts(), await store.listSessions(), Date.UTC(2026, 9, 1))).toEqual(before.queue);

    const rowsBefore = buildRows(raw.questions, before.status);
    const rowsAfter = buildRows(raw.questions, status);
    expect(poolHealth(rowsAfter, STRICT_POLICY, fixedRng())).toEqual(poolHealth(rowsBefore, STRICT_POLICY, fixedRng()));

    // A question shown in a hidden exam module is still consumed: a new test never reuses it.
    const hiddenExamIds = new Set(raw.sessions.filter((s) => s.mode === 'exam' && (hidden.includes(s.id) || hidden.includes(s.exam?.testId ?? ''))).map((s) => s.id));
    const examQuestion = raw.attempts.find((a) => hiddenExamIds.has(a.sessionId))?.questionId;
    expect(examQuestion).toBeDefined();
    const row = rowsAfter.find((r) => r.id === examQuestion);
    if (row) expect(tierOf(row)).toBe('consumed');
  }, 30_000);

  it('hides every finished session before a date, survives export and restore, and clears with all data', async () => {
    const { store } = await loadInto(raw);
    const times = raw.sessions.filter((s) => s.status === 'finished' && !s.exam?.testId).map((s) => s.finishedAt ?? s.lastActivityAt).sort((a, b) => a - b);
    const cut = times[Math.floor(times.length / 3)] as number;
    const n = await store.hideBefore(cut);
    expect(n).toBe(times.filter((t) => t < cut).length);
    expect(await store.hideBefore(cut)).toBe(0);

    const exported = await store.exportAll();
    expect(exported.hiddenSessions?.length).toBe(n);
    const { parseUserData } = await import('./validate');
    const parsed = parseUserData(JSON.parse(JSON.stringify(exported)));
    if (typeof parsed === 'string') throw new Error(parsed);
    await store.clearAll();
    expect(await store.listHidden()).toEqual([]);
    await store.replaceAll(parsed);
    expect((await store.listHidden()).length).toBe(n);
  }, 30_000);
});
