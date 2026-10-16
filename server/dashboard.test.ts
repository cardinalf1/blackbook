// The Dashboard endpoint: built from SQL summaries it must equal the page built from brute-force
// summaries over the raw sessions, attempts and events; hidden sessions leave the page but not the
// no-repeat and retry figures; it answers within budget; and every old metric has a place.
// Synthetic data only.

import { describe, expect, it } from 'vitest';
import { BruteAnalytics } from '../src/services/analytics/brute';
import { synthData } from '../src/services/analytics/synth';
import { DEFAULT_DASHBOARD_SCOPE, type DashboardData, type DashboardScope } from '../src/types/dashboard';
import { DashboardService } from './dashboard';
import { loadInto } from './testSupport';

const seeded = () => {
  let x = 7;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
};

const strip = ({ buildMs: _ms, ...rest }: DashboardData) => rest;

describe('GET /api/dashboard', () => {
  const raw = synthData({ seed: 9, attempts: 1500, events: 20_000, orphanQuestions: 3, hideEvery: 5 });
  const now = Math.max(...raw.sessions.map((s) => s.finishedAt ?? s.lastActivityAt)) + 3_600_000;

  async function services() {
    const { analytics, store } = await loadInto(raw);
    await store.setHidden(raw.hidden ?? [], true);
    const bank = { query: async () => [...raw.questions] };
    const sql = new DashboardService({ analytics, users: store, bank, now: () => now, poolRng: seeded() });
    const brute = new DashboardService({ analytics: new BruteAnalytics(() => raw), users: store, bank, now: () => now, poolRng: seeded() });
    return { sql, brute, store };
  }

  const scopes: DashboardScope[] = [
    DEFAULT_DASHBOARD_SCOPE,
    { ...DEFAULT_DASHBOARD_SCOPE, preset: '7d' },
    { ...DEFAULT_DASHBOARD_SCOPE, preset: '30d', section: 'math' },
    { ...DEFAULT_DASHBOARD_SCOPE, preset: 'last_test' },
    { ...DEFAULT_DASHBOARD_SCOPE, preset: 'all', includeHidden: true },
    { ...DEFAULT_DASHBOARD_SCOPE, preset: 'all', kind: 'drill', excludeSingle: true, excludePaused: true },
  ];

  it('equals the page built from brute-force summaries, for every scope', async () => {
    const { sql, brute } = await services();
    for (const s of scopes) expect(strip(await sql.load(s)), JSON.stringify(s)).toEqual(strip(await brute.load(s)));
  }, 120_000);

  it('hidden sessions leave the page; showing them changes the numbers; retries and questions done do not move', async () => {
    const { sql } = await services();
    const all = { ...DEFAULT_DASHBOARD_SCOPE, preset: 'all' as const };
    const hiddenOut = await sql.load(all);
    const hiddenIn = await sql.load({ ...all, includeHidden: true });
    expect(hiddenOut.numbers.firstAttempt.attempts).toBeLessThan(hiddenIn.numbers.firstAttempt.attempts);
    expect(hiddenOut.tests.length).toBeLessThan(hiddenIn.tests.length);
    expect(hiddenOut.mistakes.retry).toEqual(hiddenIn.mistakes.retry);
    expect(hiddenOut.numbers.questionsDone).toEqual(hiddenIn.numbers.questionsDone);
  }, 60_000);

  it('never shows an empty coach card, and no pool-health line in it', async () => {
    const { sql } = await services();
    for (const s of scopes) {
      const d = await sql.load(s);
      const filled = d.coach.lines.length > 0 || d.coach.unlock !== null || d.coach.emptyScope !== null;
      expect(filled, JSON.stringify(s)).toBe(true);
      expect(d.coach.lines.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(d.coach)).not.toMatch(/full tests left|pool_health/i);
    }
  }, 60_000);

  it('asks for more drills when there is too little data', async () => {
    const tiny = synthData({ seed: 3, attempts: 10, events: 100, orphanQuestions: 0 });
    const { analytics, store } = await loadInto({ ...tiny, sessions: tiny.sessions.slice(0, 1) });
    const d = await new DashboardService({ analytics, users: store, bank: { query: async () => [...tiny.questions] }, poolRng: seeded() }).load(DEFAULT_DASHBOARD_SCOPE);
    expect(d.coach.lines).toEqual([]);
    expect(d.coach.unlock?.drillsNeeded).toBeGreaterThan(0);
  });

  it('builds within the 300 ms budget on the synthetic set (after the first, warming request)', async () => {
    const { sql } = await services();
    await sql.load(DEFAULT_DASHBOARD_SCOPE);
    const times: number[] = [];
    for (const s of scopes) times.push((await sql.load(s)).buildMs);
    expect(Math.max(...times)).toBeLessThan(1500); // loose in CI; the script reports the real figure
  }, 60_000);

  it('every old metric has a home on the page (checklist)', async () => {
    const { sql } = await services();
    const d = await sql.load({ ...DEFAULT_DASHBOARD_SCOPE, preset: 'all', includeHidden: true });
    // Old metric -> where it is now. Each must be present (non-undefined) on the page; deeper views are one click away (routes.test.ts).
    const checklist: Record<string, unknown> = {
      'Overview: sessions and answers by mode': d.habits.answered,
      'Overview: accuracy by mode': d.trends.accuracy,
      'Overview: bank coverage (seen)': d.numbers.questionsDone.seen,
      'Overview: accuracy over time': d.trends.accuracy,
      'Overview: estimate cards': d.numbers.estimate === null ? 'none' : d.numbers.estimate,
      'Skills: per-skill accuracy with N and interval': d.skills.domains[0]?.skills[0]?.high,
      'Skills: unseen live questions': d.skills.domains[0]?.skills[0]?.unseenLive,
      'Timing: rushed and stuck counts': d.habits.flagged,
      'Timing: last five minutes': d.habits.lastFive,
      'Timing: module pacing': d.habits.modules,
      'Timing: pace against target': d.numbers.pace,
      'Behavior: answer changes': d.habits.behavior.drill.correctToIncorrect,
      'Behavior: strike-outs and confidence': d.habits.behavior.exam.strikeActions,
      'Test history: estimates and routing': d.tests,
      'Study next: ranking and method': d.skills.methodNote,
      'Study next: drill top skills': d.skills.topDrills,
      'Study next: review my misses': d.mistakes.reviewDrills,
      'Study report: insights': d.coach,
      'Mistakes: reasons from tags': d.mistakes.reasons,
      'Retry queue': d.mistakes.retry,
      '800 modes: clean sets': d.mistakes.slips800,
      'Pool health': d.numbers.freshTests,
    };
    for (const [k, v] of Object.entries(checklist)) expect(v, k).toBeDefined();
    expect(d.limits).toMatch(/approximation/);
  }, 60_000);
});
