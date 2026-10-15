// bun scripts/eligibility-check.ts [--data DIR] [--markdown]
//
// Prints, for the real data, how many live questions are fresh, soft (seen, never answered) and
// consumed (answered anywhere, or shown in any exam module) per section and difficulty, plus the
// pool-health simulation. Then recounts the consumed and soft sets straight from the raw attempts,
// sessions and events, without the status derivation, and exits 1 on any mismatch.

import { join, resolve } from 'node:path';
import { buildRows } from '../src/services/browse/filter';
import { countTiers, STRICT_POLICY, tierOf, type TierCounts } from '../src/services/eligibility/eligibility';
import { poolHealth } from '../src/services/test/pool';
import { DiskBankStore } from '../server/bankStore';
import { openSqlite } from '../server/sqlBun';
import { SqliteUserStore } from '../server/userDb';
import type { Difficulty, Section } from '../src/types/sat';

const i = process.argv.indexOf('--data');
const dataDir = resolve(i >= 0 ? (process.argv[i + 1] ?? '') : join('data', 'app'));
const markdown = process.argv.includes('--markdown');
const users = new SqliteUserStore(openSqlite(join(dataDir, 'user.db')));
const bank = new DiskBankStore(join(dataDir, 'bank.json'));

const [attempts, sessions, events] = await Promise.all([users.listAttempts(), users.listSessions(), users.listEvents()]);
const rows = buildRows(await bank.query({}), await users.questionStatus());
const live = rows.filter((r) => r.active);

// Independent recount from the raw records.
const answered = new Set(attempts.filter((a) => a.status === 'final' && a.response !== '').map((a) => a.questionId));
const examShown = new Set<string>();
for (const s of sessions) if (s.mode === 'exam') for (const [q, p] of Object.entries(s.progress)) if (p.visits > 0) examShown.add(q);
for (const e of events) if (e.type === 'question_shown' && e.mode === 'exam' && e.questionId) examShown.add(e.questionId);
const shownAnywhere = new Set(events.filter((e) => e.type === 'question_shown' && e.questionId).map((e) => e.questionId as string));
for (const a of attempts) shownAnywhere.add(a.questionId);
for (const q of examShown) shownAnywhere.add(q);

const problems: string[] = [];
for (const r of rows) {
  const consumed = answered.has(r.id) || examShown.has(r.id);
  const soft = !consumed && shownAnywhere.has(r.id);
  const tier = tierOf(r);
  if (tier === 'consumed' !== consumed) problems.push(`${r.id}: consumed by rule ${tier === 'consumed'}, by raw recount ${consumed}`);
  if (tier === 'soft' !== soft) problems.push(`${r.id}: soft by rule ${tier === 'soft'}, by raw recount ${soft}`);
}

const SECTIONS: Section[] = ['rw', 'math'];
const DIFFS: Difficulty[] = ['E', 'M', 'H'];
const label = (s: Section) => (s === 'rw' ? 'Reading and Writing' : 'Math');
const cell = (c: TierCounts) => `${c.fresh} / ${c.soft} / ${c.consumed}`;

console.log(`Live questions: ${live.length} of ${rows.length}. Cells show fresh / seen-not-done / consumed.`);
const head = ['Section', 'Easy', 'Medium', 'Hard', 'All'];
const table: string[][] = [head];
for (const s of SECTIONS) {
  const inSec = live.filter((r) => r.section === s);
  table.push([label(s), ...DIFFS.map((d) => cell(countTiers(inSec.filter((r) => r.difficulty === d)))), cell(countTiers(inSec))]);
}
table.push(['Both', ...DIFFS.map((d) => cell(countTiers(live.filter((r) => r.difficulty === d)))), cell(countTiers(live))]);
if (markdown) {
  console.log(`| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|`);
  for (const r of table.slice(1)) console.log(`| ${r.join(' | ')} |`);
} else {
  for (const r of table) console.log(r.map((c, k) => (k === 0 ? c.padEnd(20) : c.padStart(16))).join(''));
}

const t = performance.now();
const health = poolHealth(rows, STRICT_POLICY);
console.log(`\nPool health (estimate, ${Math.round(performance.now() - t)} ms): Reading and Writing ${health.rw}, Math ${health.math}, full tests ${health.full}${health.capped ? ' (capped)' : ''}`);
console.log(`Raw recount: ${answered.size} questions answered, ${examShown.size} shown in exams.`);

if (problems.length > 0) {
  console.error(`\n${problems.length} mismatch(es):`);
  for (const p of problems.slice(0, 20)) console.error(`  ${p}`);
  process.exit(1);
}
console.log('Cross-check passed: the rule agrees with the raw attempts, sessions and events.');
