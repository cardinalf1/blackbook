// bun run sync [--limit N] [--refresh] [--live-only] [--section rw|math]
//
// Downloads the SAT question bank into data/question_bank.json using the shared pipeline in
// src/services/sync/pipeline.ts (the same code the app's Download button runs). Raw detail
// responses are cached in data/raw/ so a rerun resumes and only refetches changed questions.
// Nothing here is committed. Endpoints and shapes: docs/api-notes.md.

import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { FsDetailCache, writeAtomic } from '../server/files';
import { DownloadStopped, KNOWN_MALFORMED, runPipeline, type DownloadScope, type PipelineDeps, type SyncReport } from '../src/services/sync/pipeline';
import type { Question, Section } from '../src/types/sat';

const DATA_DIR = 'data';
const OUT_FILE = join(DATA_DIR, 'question_bank.json');
const REPORT_FILE = join(DATA_DIR, 'sync-report.txt');
const SAMPLE_SIZE = 20;

function parseArgs(argv: string[]): DownloadScope {
  const scope: DownloadScope = { sections: ['rw', 'math'], liveOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--refresh') scope.refetchAll = true;
    else if (a === '--live-only') scope.liveOnly = true;
    else if (a === '--section') {
      const s = argv[++i];
      if (s !== 'rw' && s !== 'math') throw new Error('--section needs rw or math');
      scope.sections = [s as Section];
    } else if (a === '--limit') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n <= 0) throw new Error('--limit needs a positive integer');
      scope.limitPerSection = n;
    } else throw new Error(`Unknown argument: ${a}. Usage: bun run sync [--limit N] [--refresh] [--live-only] [--section rw|math]`);
  }
  return scope;
}

function progress(label: string, done: number, total: number, extra = ''): void {
  const line = `${label} ${done}/${total} ${extra}`;
  if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(100)}`);
  else if (done === total || done % 100 === 0) console.log(line);
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

const sorted = (m: Record<string, number>): string =>
  Object.entries(m)
    .sort()
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');

function reportLines(r: SyncReport, skippedTotal: number): string[] {
  const lines = [
    `Wrote ${OUT_FILE}: ${r.questions} questions in ${Math.round(r.durationMs / 1000)} s`,
    `  by section: ${sorted(r.bySection)}`,
    `  by section/difficulty: ${sorted(r.bySectionDifficulty)}`,
    `  by source: ${sorted(r.bySource)}`,
    `  active (in live set): ${r.active}`,
    '',
    'Legacy answer keys',
    `  structured key used:            ${r.legacyStructured}`,
    `  extracted from rationale (MCQ):  ${r.legacyExtracted}`,
    `  skipped, MCQ with no clear key:  ${r.legacyMcqNoKey}`,
    `  skipped, SPR with no key:        ${r.legacySprNoKey}`,
    '',
    `Skipped: ${skippedTotal}`,
    ...Object.entries(r.skipCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `  ${k}: ${n}`),
    ...(r.fetchFailures > 0 ? [`  fetch failures: ${r.fetchFailures} (rerun to retry)`] : []),
    '',
    `Math: ${r.mathConverted} converted to KaTeX, ${r.mathKept} kept as MathML; SVGs cleaned: ${r.svgCleaned}`,
  ];
  const kept = Object.entries(r.mathKeptReasons).sort((a, b) => b[1] - a[1]);
  if (kept.length > 0) lines.push('  kept-MathML reasons:', ...kept.slice(0, 15).map(([k, n]) => `    ${n}x ${k}`));
  return lines;
}

async function main(): Promise<number> {
  const scope = parseArgs(process.argv.slice(2));
  const { window } = new JSDOM('');
  const parse = (html: string): Document => new window.DOMParser().parseFromString(html, 'text/html');
  const readable = (html: string): string => {
    const body = parse(html).body;
    body.querySelectorAll('img').forEach((img) => img.replaceWith(` [${img.getAttribute('alt') ?? 'image'}] `));
    return (body.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  const ctl = new AbortController();
  process.on('SIGINT', () => ctl.abort());

  console.log('Fetching lookup and question lists...');
  let toFetch = 0;
  const result = await runPipeline(scope, {
    fetch: (input, init) => fetch(input, init),
    cache: new FsDetailCache(join(DATA_DIR, 'raw')),
    window: window as unknown as PipelineDeps['window'],
    signal: ctl.signal,
    onEvent: (e) => {
      if (e.type === 'plan') {
        toFetch = e.toFetch;
        console.log(`Questions in scope: ${e.questions} (${e.live} live). Details: ${e.cached} cached, ${e.toFetch} to fetch`);
      } else if (e.type === 'detail') progress('  fetched', e.done, toFetch, `(retries ${e.retries}, failed ${e.failed})`);
      else if (e.type === 'normalized') progress('  normalized', e.done, e.total);
      else if (e.type === 'stage' && e.stage === 'normalize' && process.stdout.isTTY) process.stdout.write('\n');
      else if (e.type === 'retry' && !process.stdout.isTTY) console.log(`  retry ${e.attempt} in ${e.delayMs} ms: ${e.error}`);
    },
  });
  if (process.stdout.isTTY) process.stdout.write('\n');

  const { bank, report, extracted } = result;
  await writeAtomic(OUT_FILE, JSON.stringify(bank));
  for (const s of bank.skipped) {
    if (KNOWN_MALFORMED.has(s.id)) console.warn(`  warning: ${s.id} is a known malformed source item, skipped (${s.reason})`);
  }

  const lines = reportLines(report, bank.skipped.length);
  console.log(`\n${lines.join('\n')}`);
  const sample = shuffle<Question>(extracted).slice(0, SAMPLE_SIZE);
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

  if (report.fetchFailures > 0) return 1;
  if (report.unexpectedSkipReasons.length > 0) {
    console.error(`\nUnexpected skip reasons: ${report.unexpectedSkipReasons.join(', ')}. Check ${REPORT_FILE} and data/question_bank.json "skipped".`);
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
    if (e instanceof DownloadStopped) {
      console.error(`\nSync stopped (${e.reason}): ${e.message} Progress is cached; rerun to resume.`);
    } else {
      console.error(`\nSync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    process.exit(1);
  },
);
