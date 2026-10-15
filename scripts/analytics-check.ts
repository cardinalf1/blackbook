// Cross-check for the analytics summaries (Phase 5).
//
//   bun scripts/analytics-check.ts                      your real data (a copy of data/app is used; nothing is modified)
//   bun scripts/analytics-check.ts --data DIR           another data folder
//   bun scripts/analytics-check.ts --synthetic          a generated dataset (default 5,000 answers and 200,000 events), with timings
//   bun scripts/analytics-check.ts --synthetic --attempts 800 --events 20000
//
// It recomputes every summary by brute force from the raw sessions, attempts and events
// (src/services/analytics/brute.ts, no shared code with the SQL) and compares with the SQL result
// for a spread of filters. Exits 1 on any difference.

import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { SqlAnalytics, toMetaRow } from '../server/analytics';
import { DiskBankStore } from '../server/bankStore';
import { openSqlite } from '../server/sqlBun';
import { SqliteUserStore } from '../server/userDb';
import { bruteBehavior, bruteMisses, bruteOverview, bruteSkillDetail, bruteSkills, bruteTests, bruteTiming, type RawData } from '../src/services/analytics/brute';
import { synthData } from '../src/services/analytics/synth';
import { ANALYTICS_KINDS, DEFAULT_ANALYTICS_FILTER, type AnalyticsFilter } from '../src/types/analytics';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : fallback;
};

function firstDifference(a: unknown, b: unknown, path = ''): string | null {
  if (isDeepStrictEqual(a, b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} (SQL) vs ${b.length} (brute force)`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `${path}: ${JSON.stringify(a)} (SQL) vs ${JSON.stringify(b)} (brute force)`;
}

function filtersFor(raw: RawData): { name: string; f: AnalyticsFilter }[] {
  const times = raw.sessions.map((s) => s.finishedAt ?? s.lastActivityAt).sort((a, b) => a - b);
  const mid = times[Math.floor(times.length / 2)] ?? 0;
  const base = DEFAULT_ANALYTICS_FILTER;
  return [
    { name: 'default', f: base },
    ...ANALYTICS_KINDS.filter((k) => k !== 'all').map((kind) => ({ name: `kind=${kind}`, f: { ...base, kind } })),
    { name: 'section=rw', f: { ...base, section: 'rw' as const } },
    { name: 'section=math', f: { ...base, section: 'math' as const } },
    { name: 'excludePaused', f: { ...base, excludePaused: true } },
    { name: 'excludeSingle', f: { ...base, excludeSingle: true } },
    { name: 'from=median', f: { ...base, from: mid } },
    { name: 'to=median, no paused, no single', f: { ...base, to: mid, excludePaused: true, excludeSingle: true } },
  ];
}

const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'bb-analytics-'));
  let raw: RawData;
  let analytics: SqlAnalytics;
  let source: string;
  const closers: (() => void)[] = [];
  try {
    if (flag('--synthetic')) {
      const attempts = Number(value('--attempts', '5000'));
      const events = Number(value('--events', '200000'));
      raw = synthData({ seed: 11, attempts, events, orphanQuestions: 5 });
      const db = openSqlite(join(tmp, 'user.db'));
      closers.push(() => db.close());
      const store = new SqliteUserStore(db);
      const byInput = new Map<string, typeof raw.attempts>();
      for (const a of raw.attempts) byInput.set(a.sessionId, [...(byInput.get(a.sessionId) ?? []), a]);
      for (const s of raw.sessions) await store.saveSession(s, byInput.get(s.id) ?? []);
      for (let i = 0; i < raw.events.length; i += 5000) await store.appendEvents(raw.events.slice(i, i + 5000));
      const rows = raw.questions.map(toMetaRow);
      analytics = new SqlAnalytics(db, { load: async () => ({ signature: 'synthetic', rows }) });
      source = `synthetic (${raw.attempts.length} answers, ${raw.events.length} events, ${raw.sessions.length} sessions)`;
    } else {
      const folder = resolve(value('--data', join('data', 'app')));
      if (!existsSync(join(folder, 'user.db'))) throw new Error(`No user.db in ${folder}. Run the app once, or use --synthetic.`);
      // Work on a copy: opening a database can migrate it, and the app may be running.
      for (const name of ['user.db', 'user.db-wal', 'user.db-shm']) if (existsSync(join(folder, name))) copyFileSync(join(folder, name), join(tmp, name));
      const db = openSqlite(join(tmp, 'user.db'));
      closers.push(() => db.close());
      const store = new SqliteUserStore(db);
      const bank = new DiskBankStore(join(folder, 'bank.json'));
      raw = { sessions: await store.listSessions(), attempts: await store.listAttempts(), events: await store.listEvents(), questions: await bank.query({}) };
      analytics = new SqlAnalytics(db, { load: () => bank.analyticsMeta() });
      source = `your data in ${folder} (${raw.attempts.length} answers, ${raw.events.length} events, ${raw.sessions.length} sessions, ${raw.questions.length} bank questions)`;
    }

    console.log(`Source: ${source}\n`);
    let failures = 0;
    const timings: { name: string; ms: number[] }[] = [];
    const timed = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
      const t0 = performance.now();
      const out = await fn();
      const ms = performance.now() - t0;
      const row = timings.find((t) => t.name === name) ?? { name, ms: [] };
      row.ms.push(ms);
      if (!timings.includes(row)) timings.push(row);
      return out;
    };

    for (const { name, f } of filtersFor(raw)) {
      const checks: [string, () => Promise<unknown>, () => unknown][] = [
        ['overview', () => analytics.overview(f), () => bruteOverview(raw, f)],
        ['skills', () => analytics.skills(f), () => bruteSkills(raw, f)],
        ['misses', () => analytics.misses(f), () => bruteMisses(raw, f)],
        ['timing', () => analytics.timing(f), () => bruteTiming(raw, f)],
        ['behavior', () => analytics.behavior(f), () => bruteBehavior(raw, f)],
        ['tests', () => analytics.tests(f), () => bruteTests(raw, f)],
      ];
      const bad: string[] = [];
      for (const [what, sql, brute] of checks) {
        const d = firstDifference(await timed(what, sql), brute());
        if (d) bad.push(`${what}: ${d}`);
      }
      failures += bad.length;
      console.log(`${bad.length === 0 ? 'ok  ' : 'FAIL'} filter ${name}${bad.length ? `\n       ${bad.join('\n       ')}` : ''}`);
    }

    // One skill's detail, for the busiest skill.
    const skills = await analytics.skills(DEFAULT_ANALYTICS_FILTER);
    const busiest = [...skills.rows].sort((a, b) => b.counts.drill.attempts + b.counts.exam.attempts - (a.counts.drill.attempts + a.counts.exam.attempts))[0];
    if (busiest) {
      const d = firstDifference(await timed('skillDetail', () => analytics.skillDetail(DEFAULT_ANALYTICS_FILTER, busiest.skillCode)), bruteSkillDetail(raw, DEFAULT_ANALYTICS_FILTER, busiest.skillCode));
      failures += d ? 1 : 0;
      console.log(`${d ? 'FAIL' : 'ok  '} skill detail for ${busiest.skill}${d ? `\n       ${d}` : ''}`);
    }

    // The headline numbers, from the SQL side, for the default view.
    const f = DEFAULT_ANALYTICS_FILTER;
    const o = await analytics.overview(f);
    const t = await analytics.timing(f);
    const b = await analytics.behavior(f);
    console.log('\nHeadline numbers (default view: all finished sessions)');
    for (const mode of ['drill', 'exam'] as const) {
      const c = o.attempts[mode];
      console.log(`  ${mode}: ${o.sessions[mode]} sessions, ${c.attempts} answers, ${c.correct} right (${pct(c.correct, c.attempts)}), average ${c.attempts ? Math.round(c.timeMs / c.attempts / 1000) : 0} s per answer, active ${Math.round(o.activeMs[mode] / 60000)} min`);
      const bc = b.counts[mode];
      console.log(`        answer changes ${bc.changes} on ${bc.questionsWithChange} answers; right-to-wrong ${bc.correctToIncorrect}, wrong-to-right ${bc.incorrectToCorrect}; strikes on ${bc.questionsWithStrike} of ${bc.mcqAnswered} multiple-choice answers`);
      console.log(`        flagged: ${t.flaggedCounts.rushedWrong[mode]} rushed and wrong, ${t.flaggedCounts.stuck[mode]} stuck`);
    }
    console.log(`  bank: ${o.bank.seen} of ${o.bank.total} questions seen (${o.bank.seenLive} of ${o.bank.live} live); ${o.unattributed} answers on questions no longer in the bank`);
    console.log(`  timing groups usable: ${t.baselines.filter((x) => x.usable).length} of ${t.baselines.length}`);

    if (flag('--synthetic')) {
      console.log('\nTimings (SQL only, ms; first call of each includes copying question facts into the temp table)');
      let worst = 0;
      for (const row of timings) {
        const sorted = [...row.ms].sort((a, b2) => a - b2);
        const median = sorted[Math.floor(sorted.length / 2)] as number;
        const max = sorted[sorted.length - 1] as number;
        worst = Math.max(worst, max);
        console.log(`  ${row.name.padEnd(12)} median ${median.toFixed(1).padStart(7)}  max ${max.toFixed(1).padStart(7)}  (${row.ms.length} calls)`);
      }
      console.log(`  slowest single call: ${worst.toFixed(1)} ms (target 300 ms)${worst <= 300 ? '' : '  OVER TARGET'}`);
      if (worst > 300) failures++;
    }

    console.log(failures === 0 ? '\nCross-check passed.' : `\nCross-check FAILED: ${failures} difference(s).`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    for (const close of closers) close();
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Windows may keep the copied database locked for a moment; the temp folder is harmless.
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
