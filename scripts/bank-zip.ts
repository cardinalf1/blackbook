// The question-bank backup zip from the command line (the app has Export and Import buttons too).
//
//   bun scripts/bank-zip.ts export <bank.json> <output folder>
//       Writes Blackbook-QuestionBank-<date>.zip from an app bank file (data folder bank.json) or
//       a `bun run sync` output, then verifies it with the round trip below.
//   bun scripts/bank-zip.ts verify <zip> <bank.json>
//       Imports the zip into a temporary data folder exactly as the app does, checks that the
//       count and every section and difficulty breakdown match the source bank, then deletes the
//       temporary folder.
//
// Never point the output folder inside the repo: the zip holds the downloaded questions.

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { importBankText } from '../src/services/import/importBank';
import { createSanitizer } from '../src/services/normalize/sanitize';
import type { Question, SkippedQuestion } from '../src/types/sat';
import { APP_VERSION } from '../src/version';
import { buildBankZip, countBank, readBankZip } from '../server/bankZip';
import { DiskBankStore } from '../server/bankStore';

interface SourceBank {
  questions: Question[];
  skipped: SkippedQuestion[];
  fetchedAt: string;
}

async function loadSource(path: string): Promise<SourceBank> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as { questions?: Question[]; skipped?: SkippedQuestion[]; fetchedAt?: string; meta?: { fetchedAt?: string } };
  if (!Array.isArray(raw.questions)) throw new Error(`${path} has no questions array.`);
  return { questions: raw.questions, skipped: raw.skipped ?? [], fetchedAt: raw.fetchedAt ?? raw.meta?.fetchedAt ?? '' };
}

function insideRepo(path: string): boolean {
  const rel = relative(resolve('.'), resolve(path));
  return !rel.startsWith('..') && !resolve(path).startsWith('\\\\') && rel !== resolve(path);
}

async function verify(zipPath: string, source: SourceBank): Promise<void> {
  const bytes = new Uint8Array(await readFile(zipPath));
  const opened = readBankZip(bytes);
  if (!opened.ok) throw new Error(`Zip check failed: ${opened.error}`);
  const temp = await mkdtemp(join(tmpdir(), 'blackbook-verify-'));
  try {
    const store = new DiskBankStore(join(temp, 'bank.json'));
    const { window } = new JSDOM('');
    const result = await importBankText(opened.text, { store, sanitize: createSanitizer(window as unknown as Parameters<typeof createSanitizer>[0]), yieldToBrowser: async () => undefined });
    if (!result.ok) throw new Error(`Import failed: ${result.error}`);
    const imported = countBank(await store.query({}));
    const expected = countBank(source.questions);
    const same = JSON.stringify(imported) === JSON.stringify(expected);
    console.log(`Imported ${result.imported} questions into a temporary folder (${result.invalid.length} invalid).`);
    console.log(`Source:   ${JSON.stringify(expected)}`);
    console.log(`Imported: ${JSON.stringify(imported)}`);
    if (!same || result.invalid.length > 0) throw new Error('The round trip does not match the source bank.');
    console.log('Round trip OK: count, live, section and difficulty breakdowns all match.');
  } finally {
    await rm(temp, { recursive: true, force: true });
    console.log('Temporary folder deleted.');
  }
}

async function main(): Promise<void> {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'export' && a && b) {
    if (insideRepo(b)) throw new Error('Refusing to write the bank zip inside the repo. Pick a folder outside it, such as Documents.');
    const source = await loadSource(a);
    const zip = buildBankZip(source, APP_VERSION);
    await mkdir(b, { recursive: true });
    const out = join(b, zip.name);
    await writeFile(out, zip.bytes);
    console.log(`Wrote ${out} (${(await stat(out)).size} bytes, SHA-256 of the bank file ${zip.manifest.sha256}).`);
    await verify(out, source);
    return;
  }
  if (cmd === 'verify' && a && b) {
    await verify(a, await loadSource(b));
    return;
  }
  console.error('Usage: bun scripts/bank-zip.ts export <bank.json> <output folder> | verify <zip> <bank.json>');
  process.exit(2);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
