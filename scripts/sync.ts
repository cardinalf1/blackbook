// bun run sync [--limit N] [--refresh]
//
// Downloads the SAT question bank from the College Board Educator Question Bank API into
// data/question_bank.json. Raw detail responses are cached in data/raw/ so a rerun resumes where
// it stopped and only refetches questions whose updateDate changed. Nothing here is committed.
// Endpoints and shapes: docs/api-notes.md.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { normalizeHtml, emptyStats, mergeStats } from '../src/services/normalize/html';
import { createSanitizer } from '../src/services/normalize/sanitize';
import { fetchJson, HttpError, runPool } from '../src/services/sync/http';
import { guardListRow, guardLookup, rowId, type RawListRow } from '../src/services/sync/raw';
import { canonicalSkillNames, dedupeRows, toQuestion, type SkipReason } from '../src/services/sync/toQuestion';
import { BANK_SCHEMA_VERSION, type Question, type QuestionBank, type Section, type SkippedQuestion } from '../src/types/sat';

const API = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const SAT = 99;
const SECTIONS: { section: Section; test: number; domains: string }[] = [
  { section: 'rw', test: 1, domains: 'INI,CAS,EOI,SEC' },
  { section: 'math', test: 2, domains: 'H,P,Q,S' },
];
const CONCURRENCY = 2;
const MIN_GAP_MS = 250;
const MAX_CONSECUTIVE_FAILURES = 10;
const SAMPLE_SIZE = 20;

const DATA_DIR = 'data';
const RAW_DIR = join(DATA_DIR, 'raw');
const OUT_FILE = join(DATA_DIR, 'question_bank.json');
const REPORT_FILE = join(DATA_DIR, 'sync-report.txt');

/** Reasons that reflect a deliberate policy rather than a problem with the data or the code. */
const EXPECTED_SKIPS: ReadonlySet<string> = new Set(['known-malformed', 'legacy-spr-no-key', 'legacy-mcq-no-key', 'mcq-key-conflicts-rationale']);

/** Items the source publishes malformed (verified by hand). Skipped with a warning, not a failure. */
const KNOWN_MALFORMED: ReadonlySet<string> = new Set(['029650-DC']); // legacy SPR, detail has no prompt

interface CachedDetail {
  updatedAt: number;
  detail: unknown;
}

interface Args {
  limit: number | null;
  refresh: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: null, refresh: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--refresh') args.refresh = true;
    else if (a === '--limit') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n <= 0) throw new Error('--limit needs a positive integer');
      args.limit = n;
    } else throw new Error(`Unknown argument: ${a}. Usage: bun run sync [--limit N] [--refresh]`);
  }
  return args;
}

function cachePath(id: string): string {
  return join(RAW_DIR, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
}

async function readCache(id: string): Promise<CachedDetail | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(id), 'utf8')) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'updatedAt' in parsed && 'detail' in parsed) {
      const { updatedAt, detail } = parsed as { updatedAt: unknown; detail: unknown };
      if (typeof updatedAt === 'number') return { updatedAt, detail };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeAtomic(path: string, data: string): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, data, 'utf8');
  await rename(tmp, path);
}

function progress(label: string, done: number, total: number, extra: string): void {
  const line = `${label} ${done}/${total} ${extra}`;
  if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(100)}`);
  else if (done === total || done % 100 === 0) console.log(line);
}

function endProgress(): void {
  if (process.stdout.isTTY) process.stdout.write('\n');
}

function count<K extends string>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(RAW_DIR, { recursive: true });
  const started = Date.now();

  const { window } = new JSDOM('');
  const env = { DOMParser: window.DOMParser };
  const sanitize = createSanitizer(window);
  const parse = (html: string): Document => new window.DOMParser().parseFromString(html, 'text/html');
  const textOf = (html: string): string => parse(html).body.textContent ?? '';
  /** Readable text for the eyeball sample: images become their alt text, math its LaTeX. */
  const readable = (html: string): string => {
    const body = parse(html).body;
    body.querySelectorAll('img').forEach((img) => img.replaceWith(` [${img.getAttribute('alt') ?? 'image'}] `));
    return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  // 1. Lookup and lists. Any shape drift here aborts the run.
  console.log('Fetching lookup and question lists...');
  const lookupG = guardLookup(await fetchJson(`${API}/lookup`, { method: 'GET', headers: HEADERS }));
  if (!lookupG.ok) throw new Error(`Lookup shape changed: ${lookupG.problem}`);
  const activeIds = new Set([...lookupG.value.readingLiveItems, ...lookupG.value.mathLiveItems]);

  const work: { section: Section; row: RawListRow }[] = [];
  const allRows: RawListRow[] = [];
  for (const s of SECTIONS) {
    const raw = await fetchJson(`${API}/digital/get-questions`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ asmtEventId: SAT, test: s.test, domain: s.domains }),
    });
    if (!Array.isArray(raw)) throw new Error(`List for ${s.section} is not an array`);
    const rows: RawListRow[] = [];
    const problems = new Map<string, number>();
    for (const r of raw) {
      const g = guardListRow(r);
      if (g.ok) rows.push(g.value);
      else count(problems, g.problem);
    }
    if (problems.size > 0) {
      throw new Error(`List rows for ${s.section} changed shape: ${[...problems].map(([p, n]) => `${n}x ${p}`).join('; ')}`);
    }
    const unique = dedupeRows(rows);
    console.log(`  ${s.section}: ${raw.length} rows, ${unique.length} unique`);
    allRows.push(...unique);
    for (const row of args.limit === null ? unique : unique.slice(0, args.limit)) work.push({ section: s.section, row });
  }
  const skillNames = canonicalSkillNames(allRows);

  // 2. Details: fetch what is missing or stale.
  const cache = new Map<string, CachedDetail>();
  const toFetch: RawListRow[] = [];
  for (const { row } of work) {
    const c = args.refresh ? null : await readCache(rowId(row));
    if (c !== null && c.updatedAt >= row.updateDate) cache.set(rowId(row), c);
    else toFetch.push(row);
  }
  console.log(`Details: ${cache.size} cached, ${toFetch.length} to fetch (${CONCURRENCY} at a time, >=${MIN_GAP_MS} ms apart)`);

  const fetchFailures: SkippedQuestion[] = [];
  let fetched = 0;
  let retries = 0;
  let consecutiveFailures = 0;
  let aborted = false;
  await runPool(toFetch, {
    concurrency: CONCURRENCY,
    minGapMs: MIN_GAP_MS,
    stop: () => aborted,
    worker: async (row) => {
      const id = rowId(row);
      const detail = await fetchJson(
        `${API}/digital/get-question`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify({ external_id: id }) },
        { onRetry: () => void retries++ },
      );
      const entry: CachedDetail = { updatedAt: row.updateDate, detail };
      await writeAtomic(cachePath(id), JSON.stringify(entry));
      cache.set(id, entry);
      fetched++;
      consecutiveFailures = 0;
      progress('  fetched', fetched + fetchFailures.length, toFetch.length, `(retries ${retries}, failed ${fetchFailures.length})`);
    },
    onError: (row, e) => {
      const reason = e instanceof HttpError ? `http ${e.status}` : `fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      fetchFailures.push({ id: rowId(row), reason });
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) aborted = true;
    },
  });
  if (toFetch.length > 0) endProgress();
  if (aborted) {
    console.error(`\nStopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row. Progress is cached; rerun to resume.`);
    return 1;
  }

  // 3. Normalize.
  const questions: Question[] = [];
  const skipped: SkippedQuestion[] = [...fetchFailures];
  const skipCounts = new Map<string, number>();
  const stats = emptyStats();
  const extracted: Question[] = [];
  let legacyStructured = 0;
  for (const [i, { section, row }] of work.entries()) {
    const id = rowId(row);
    const c = cache.get(id);
    if (c === undefined) continue; // fetch failed, already recorded
    const r = toQuestion(row, c.detail, {
      section,
      activeIds,
      skillNames,
      textOf,
      html: (html, qid, field) => {
        const n = normalizeHtml(env, html, `${qid}-${field}`);
        mergeStats(stats, n.stats);
        return sanitize(n.html);
      },
    });
    if (r.ok) {
      questions.push(r.question);
      if (r.keyFromRationale) extracted.push(r.question);
      else if (r.question.source === 'legacy') legacyStructured++;
    } else {
      skipped.push({ id, reason: r.detail ? `${r.reason}: ${r.detail}` : r.reason });
      if (r.reason === 'detail-shape' && KNOWN_MALFORMED.has(id)) {
        console.warn(`  warning: ${id} is a known malformed source item, skipped (${r.detail ?? 'detail-shape'})`);
        count(skipCounts, 'known-malformed');
      } else {
        count(skipCounts, r.reason);
      }
    }
    progress('  normalized', i + 1, work.length, '');
  }
  endProgress();

  const bank: QuestionBank = { schemaVersion: BANK_SCHEMA_VERSION, fetchedAt: new Date().toISOString(), questions, skipped };
  await writeAtomic(OUT_FILE, JSON.stringify(bank));

  // 4. Report.
  const lines: string[] = [];
  const by = (f: (q: Question) => string): string => {
    const m = new Map<string, number>();
    for (const q of questions) count(m, f(q));
    return [...m].sort().map(([k, n]) => `${k} ${n}`).join(', ');
  };
  const legacySprSkipped = skipCounts.get('legacy-spr-no-key') ?? 0;
  const legacyMcqNoKey = skipCounts.get('legacy-mcq-no-key') ?? 0;
  lines.push(
    `Wrote ${OUT_FILE}: ${questions.length} questions in ${Math.round((Date.now() - started) / 1000)} s`,
    `  by section: ${by((q) => q.section)}`,
    `  by section/difficulty: ${by((q) => `${q.section}/${q.difficulty}`)}`,
    `  by source: ${by((q) => q.source)}`,
    `  active (in live set): ${questions.filter((q) => q.active).length}`,
    '',
    'Legacy answer keys',
    `  structured key used:            ${legacyStructured}`,
    `  extracted from rationale (MCQ):  ${extracted.length}`,
    `  skipped, MCQ with no clear key:  ${legacyMcqNoKey}`,
    `  skipped, SPR with no key:        ${legacySprSkipped}`,
    '',
    `Skipped: ${skipped.length}`,
    ...[...skipCounts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`),
    ...(fetchFailures.length > 0 ? [`  fetch failures: ${fetchFailures.length} (rerun to retry)`] : []),
    '',
    `Math: ${stats.mathConverted} converted to KaTeX, ${stats.mathKept} kept as MathML; SVGs cleaned: ${stats.svgCleaned}`,
  );
  if (stats.mathKept > 0) {
    const reasons = new Map<string, number>();
    for (const r of stats.mathKeptReasons) count(reasons, r.slice(0, 80));
    lines.push('  kept-MathML reasons:', ...[...reasons].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([r, n]) => `    ${n}x ${r}`));
  }
  console.log(`\n${lines.join('\n')}`);

  const sample = shuffle(extracted).slice(0, SAMPLE_SIZE);
  const sampleLines = sample.map((q, i) => {
    const key = q.answer.kind === 'mcq' ? q.answer.correct : '?';
    return `#${i + 1} ${q.id} (${q.displayId}) extracted key: ${key}\n    ${readable(q.rationaleHtml)}`;
  });
  if (sample.length > 0) {
    console.log(`\n${sample.length} random answers extracted from rationale. Check each key against its explanation:\n`);
    console.log(sampleLines.join('\n\n'));
  }
  await writeAtomic(REPORT_FILE, `${lines.join('\n')}\n\nExtracted-answer sample\n\n${sampleLines.join('\n\n')}\n`);
  console.log(`\nReport saved to ${REPORT_FILE}`);

  const unexpected = [...skipCounts.keys()].filter((k) => !EXPECTED_SKIPS.has(k));
  if (fetchFailures.length > 0) return 1;
  if (unexpected.length > 0) {
    console.error(`\nUnexpected skip reasons: ${unexpected.join(', ')}. Check ${REPORT_FILE} and data/question_bank.json "skipped".`);
    return 2;
  }
  return 0;
}

process.on('unhandledRejection', (e) => {
  console.error('Unhandled rejection:', e);
  process.exit(1);
});

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`\nSync failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
