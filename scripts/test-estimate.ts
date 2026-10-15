// bun scripts/test-estimate.ts [--data DIR] [--test ID]
//
// Prints the score estimate of the last finished full test or section run (or the one given) and
// cross-checks it: the estimate and the routing decision are recomputed from the stored module
// sessions, questions and attempts and must equal what was stored, and every module answer must
// match its stored attempt. Reads the local data folder only (default data/app). Exits 1 on any
// mismatch.

import { join, resolve } from 'node:path';
import { DiskBankStore } from '../server/bankStore';
import { openSqlite } from '../server/sqlBun';
import { SqliteUserStore } from '../server/userDb';
import { buildReport } from '../src/services/session/report';
import { computeEstimate, routingItems, type ModuleData } from '../src/services/test/report';
import { decideRoute } from '../src/services/test/routing';
import type { Question } from '../src/types/sat';
import type { ModuleKey, TestModuleSlot } from '../src/types/test';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const dataDir = resolve(flag('--data') ?? join('data', 'app'));
const users = new SqliteUserStore(openSqlite(join(dataDir, 'user.db')));
const bank = new DiskBankStore(join(dataDir, 'bank.json'));

const wanted = flag('--test');
const finished = (await users.listSessions({ status: 'finished' })).filter((s) => s.test);
const container = wanted ? await users.getSession(wanted) : [...finished].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
if (!container?.test) {
  console.log('No finished full test or section run found.');
  process.exit(1);
}
const test = container.test;
let problems = 0;
const bad = (m: string) => {
  problems++;
  console.log(`MISMATCH: ${m}`);
};

const slots = Object.values(test.slots) as TestModuleSlot[];
const all = await users.listSessions({ mode: 'exam' });
const modules: ModuleData[] = [];
for (const slot of slots) {
  const session = slot.sessionId === null ? undefined : all.find((s) => s.id === slot.sessionId);
  if (!session) {
    bad(`module ${slot.key} has no stored session`);
    continue;
  }
  const qs = new Map<string, Question>();
  for (const id of session.queueIds) {
    const q = await bank.get(id);
    if (q) qs.set(id, q);
  }
  const attempts = await users.listAttempts(session.id);
  const report = buildReport(session, qs, attempts);
  // Inputs: every stored final attempt must match the session's answer and the recomputed grade.
  for (const item of report.items) {
    const a = attempts.find((x) => x.questionId === item.questionId && x.status === 'final');
    const stored = a?.response ?? '';
    if (stored !== (item.response ?? '')) bad(`${slot.key} ${item.displayId}: attempt response "${stored}" vs session "${item.response ?? ''}"`);
    if (a && item.response !== null && a.correct !== item.correct) bad(`${slot.key} ${item.displayId}: attempt graded ${a.correct}, recomputed ${item.correct}`);
  }
  if (session.queueIds.length !== slot.questionIds.length) bad(`${slot.key}: session has ${session.queueIds.length} questions, slot has ${slot.questionIds.length}`);
  modules.push({ key: slot.key as ModuleKey, session, report });
  console.log(`${slot.key}: ${report.score.correct}/${report.score.total} correct, tier ${slot.tier}`);
}

// Routing: recompute from module 1 and compare with the stored decision (same config version only).
for (const r of test.routing) {
  const m1 = modules.find((m) => m.key === `${r.section}1`);
  if (!m1) continue;
  const again = decideRoute(r.section, routingItems(m1.report), r.at, r.threshold);
  const same = again.route === r.route && Math.abs(again.weightedFraction - r.weightedFraction) < 1e-9 && again.correct === r.correct;
  console.log(`routing ${r.section}: weighted ${(r.weightedFraction * 100).toFixed(1)}% vs threshold ${(r.threshold * 100).toFixed(0)}% -> ${r.route}${same ? '' : ' (DIFFERS on recompute)'}`);
  if (!same) bad(`routing ${r.section}: stored ${r.route}/${r.weightedFraction}, recomputed ${again.route}/${again.weightedFraction}`);
}

// Estimate: only comparable when the stored one used the config version in force now.
const stored = test.estimate;
const recomputed = computeEstimate(test.routing, modules);
console.log(`\nestimate (config v${stored?.configVersion ?? '?'}):`);
for (const s of stored?.sections ?? []) console.log(`  ${s.section}: ${s.low} to ${s.high} (mid ${s.mid}, ${s.route} route, ${s.answered}/${s.total} answered${s.capped ? ', top capped' : ''})`);
if (stored?.total) console.log(`  total: ${stored.total.low} to ${stored.total.high} (mid ${stored.total.mid})`);
if (!stored || !recomputed) bad('no estimate stored or computable');
else if (stored.configVersion === recomputed.configVersion) {
  if (JSON.stringify(stored) !== JSON.stringify(recomputed)) bad('stored estimate differs from the recomputed one');
} else {
  console.log(`  (stored with config v${stored.configVersion}, current is v${recomputed.configVersion}: not recomputed, by design)`);
}
console.log(`\ntest paused: ${test.paused}; break: ${test.break ? (test.break.endedEarly ? 'ended early' : 'ran out') : 'none'}`);
console.log(problems === 0 ? 'Cross-check passed.' : `${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
