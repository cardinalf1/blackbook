// bun scripts/telemetry-check.ts [--data DIR] [--session ID]
//
// Prints the derived metrics for the last finished session (or the one given) and cross-checks
// them against what was stored: answers, change counts, active time and the score. Also reports
// the event log size for that session and extrapolates it to 1,000 questions.
// Reads the local data folder only (default data/app, the dev data). Exits 1 on any mismatch.

import { join, resolve } from 'node:path';
import { isCorrect } from '../src/services/answers';
import { sessionMetrics } from '../src/services/telemetry/metrics';
import { DiskBankStore } from '../server/bankStore';
import { openSqlite } from '../server/sqlBun';
import { SqliteUserStore } from '../server/userDb';

/** Derived active time is measured from event timestamps, the stored one by the screen's timer. */
const ACTIVE_TOLERANCE_MS = 1500;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const dataDir = resolve(flag('--data') ?? join('data', 'app'));
const db = openSqlite(join(dataDir, 'user.db'));
const users = new SqliteUserStore(db);
const bank = new DiskBankStore(join(dataDir, 'bank.json'));

const wanted = flag('--session');
const sessions = await users.listSessions({ status: 'finished' });
const session = wanted ? await users.getSession(wanted) : [...sessions].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
if (!session) {
  console.error('No finished session found.');
  process.exit(1);
}

const [events, attempts] = await Promise.all([users.listEvents(session.id), users.listAttempts(session.id)]);
const questions = new Map((await Promise.all(session.queueIds.map((id) => bank.get(id)))).flatMap((q) => (q ? [[q.id, q] as const] : [])));
const grade = (id: string, r: string) => {
  const q = questions.get(id);
  return q !== undefined && isCorrect(q.answer, r);
};
const m = sessionMetrics(session.id, events, grade);
const byId = new Map(m.questions.map((q) => [q.questionId, q]));
const attemptOf = new Map(attempts.map((a) => [a.questionId, a]));

const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
console.log(`Session ${session.id} (${session.mode}), ${session.queueIds.length} questions, finished ${new Date(session.finishedAt ?? 0).toLocaleString()}`);
console.log(`Events: ${events.length} in ${m.totals.pageLoads} page load(s)\n`);
console.log(' #  question  visits  active  stored  wall    hidden  idle   1st-act  chain            changes  c>i i>c  flags  conf');

const problems: string[] = [];
let derivedCorrect = 0;
session.queueIds.forEach((id, i) => {
  const q = byId.get(id);
  const p = session.progress[id];
  const a = attemptOf.get(id);
  const chain = q?.answerChain.map((r) => (r === '' ? '∅' : r)).join('>') ?? '';
  console.log(
    [
      String(i + 1).padStart(2),
      (questions.get(id)?.displayId ?? id).slice(0, 8).padEnd(8),
      String(q?.visits ?? 0).padStart(6),
      s(q?.activeMs ?? 0).padStart(7),
      s(p?.activeMs ?? 0).padStart(7),
      s(q?.wallMs ?? 0).padStart(6),
      s(q?.hiddenMs ?? 0).padStart(7),
      s(q?.idleMs ?? 0).padStart(6),
      (q?.timeToFirstInteractionMs == null ? '-' : s(q.timeToFirstInteractionMs)).padStart(8),
      ` ${chain.slice(0, 16).padEnd(16)}`,
      String(q?.changes ?? 0).padStart(7),
      String(q?.correctToIncorrect ?? 0).padStart(4),
      String(q?.incorrectToCorrect ?? 0).padStart(3),
      String(q?.flagHistory.length ?? 0).padStart(6),
      ` ${q?.confidenceChain.join('>') ?? ''}`,
    ].join(' '),
  );

  // Cross-checks against what the session and attempts stored.
  const derived = q?.finalResponse ?? null;
  const stored = p?.response ?? null;
  if (derived !== stored) problems.push(`#${i + 1}: answer from events ${derived} vs session ${stored}`);
  if ((a?.response || null) !== stored) problems.push(`#${i + 1}: attempt answer ${a?.response} vs session ${stored}`);
  if (stored !== null && a?.status !== 'final') problems.push(`#${i + 1}: answered but attempt is ${a?.status ?? 'missing'}`);
  if ((q?.changes ?? 0) !== (p?.changes ?? 0)) problems.push(`#${i + 1}: changes from events ${q?.changes ?? 0} vs session ${p?.changes ?? 0}`);
  if (a?.status === 'final' && a.changes !== (p?.changes ?? 0)) problems.push(`#${i + 1}: attempt changes ${a.changes} vs session ${p?.changes ?? 0}`);
  if (Math.abs((q?.activeMs ?? 0) - (p?.activeMs ?? 0)) > ACTIVE_TOLERANCE_MS) {
    problems.push(`#${i + 1}: active time from events ${s(q?.activeMs ?? 0)} vs stored ${s(p?.activeMs ?? 0)}`);
  }
  if (a?.status === 'final' && a.timeMs !== (p?.activeMs ?? 0)) problems.push(`#${i + 1}: attempt time ${a.timeMs} vs session ${p?.activeMs}`);
  if (derived !== null && grade(id, derived)) derivedCorrect++;
  if (a && derived !== null && a.correct !== grade(id, derived)) problems.push(`#${i + 1}: stored grade ${a.correct} vs regraded`);
});

console.log(`\nTotals: active ${s(m.totals.activeMs)} (stored ${s(session.totalActiveMs)}), wall ${s(m.totals.wallMs)}, hidden ${s(m.totals.hiddenMs)}, idle ${s(m.totals.idleMs)}`);
console.log(`Changes ${m.totals.changes}, correct-to-incorrect ${m.totals.correctToIncorrect}, incorrect-to-correct ${m.totals.incorrectToCorrect}`);
const d = m.distributions.activeMs;
if (d) console.log(`Active time per question: median ${s(d.median)}, p90 ${s(d.p90)}, max ${s(d.max)}`);
const f = m.distributions.timeToFirstInteractionMs;
if (f) console.log(`Time to first interaction: median ${s(f.median)}, p90 ${s(f.p90)}`);
console.log(`Score: events say ${derivedCorrect}/${session.queueIds.length}, session says ${session.score?.correct}/${session.score?.total}`);
if (derivedCorrect !== session.score?.correct) problems.push(`score from events ${derivedCorrect} vs session ${session.score?.correct}`);

// Size of this session's events, the same estimate the Data page shows.
const size = db.get<{ n: number; bytes: number }>(
  `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(id) + LENGTH(session_id) + LENGTH(mode) + COALESCE(LENGTH(question_id), 0) +
     LENGTH(type) + LENGTH(page_id) + LENGTH(payload) + 32), 0) AS bytes FROM events WHERE session_id = ?`,
  session.id,
);
if (size) {
  const perQ = size.bytes / session.queueIds.length;
  console.log(
    `\nEvent log for this session: ${size.n} events, ${(size.bytes / 1024).toFixed(1)} KB ` +
      `(${(perQ / 1024).toFixed(2)} KB per question). At this rate 1,000 questions take about ${((perQ * 1000) / 1024 / 1024).toFixed(2)} MB, before index pages.`,
  );
}

if (problems.length > 0) {
  console.log(`\nCROSS-CHECK FAILED (${problems.length}):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nCross-check passed: answers, change counts, active time, grades and score agree with the stored records.');
