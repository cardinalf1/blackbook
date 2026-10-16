// The question-bank backup zip: `Blackbook-QuestionBank-<date>.zip` with
//   question_bank.json  the normalized bank, in the same format `bun run sync` writes
//   manifest.json       app version, schema version, counts, created date, SHA-256 of the bank file
// It is for the person's own use: restoring quickly after a reinstall. Import checks the checksum
// and the counts before the normal import validates and sanitizes every question.

import { createHash } from 'node:crypto';
import { BANK_SCHEMA_VERSION, DIFFICULTIES, SECTIONS, type Difficulty, type Question, type QuestionBank, type Section, type SkippedQuestion } from '../src/types/sat';
import { looksLikeZip, readZip, writeZip, ZipError } from './zip';

export const BANK_ZIP_FORMAT = 'blackbook-question-bank';
export const BANK_ZIP_FORMAT_VERSION = 1;
export const BANK_ENTRY = 'question_bank.json';
export const MANIFEST_ENTRY = 'manifest.json';

export interface BankCounts {
  total: number;
  live: number;
  bySection: Record<Section, number>;
  byDifficulty: Record<Difficulty, number>;
  bySectionDifficulty: Record<Section, Record<Difficulty, number>>;
}

export interface BankZipManifest {
  format: typeof BANK_ZIP_FORMAT;
  formatVersion: typeof BANK_ZIP_FORMAT_VERSION;
  appVersion: string;
  bankSchemaVersion: number;
  createdAt: string;
  fetchedAt: string;
  file: typeof BANK_ENTRY;
  sha256: string;
  counts: BankCounts;
}

const zeroDiff = (): Record<Difficulty, number> => ({ E: 0, M: 0, H: 0 });

/** Counts from anything shaped like questions; unknown sections or difficulties are not counted. */
export function countBank(questions: readonly unknown[]): BankCounts {
  const c: BankCounts = { total: questions.length, live: 0, bySection: { rw: 0, math: 0 }, byDifficulty: zeroDiff(), bySectionDifficulty: { rw: zeroDiff(), math: zeroDiff() } };
  for (const raw of questions) {
    const q = raw as Partial<Question>;
    if (q.active === true) c.live++;
    const s = SECTIONS.includes(q.section as Section) ? (q.section as Section) : null;
    const d = DIFFICULTIES.includes(q.difficulty as Difficulty) ? (q.difficulty as Difficulty) : null;
    if (s) c.bySection[s]++;
    if (d) c.byDifficulty[d]++;
    if (s && d) c.bySectionDifficulty[s][d]++;
  }
  return c;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function bankZipName(now: Date): string {
  return `Blackbook-QuestionBank-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`;
}

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function buildBankZip(
  bank: { questions: readonly Question[]; skipped: readonly SkippedQuestion[]; fetchedAt: string },
  appVersion: string,
  now: Date = new Date(),
): { name: string; bytes: Uint8Array; manifest: BankZipManifest } {
  const file: QuestionBank = { schemaVersion: BANK_SCHEMA_VERSION, fetchedAt: bank.fetchedAt, questions: [...bank.questions], skipped: [...bank.skipped] };
  const data = new TextEncoder().encode(JSON.stringify(file));
  const manifest: BankZipManifest = {
    format: BANK_ZIP_FORMAT,
    formatVersion: BANK_ZIP_FORMAT_VERSION,
    appVersion,
    bankSchemaVersion: BANK_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    fetchedAt: bank.fetchedAt,
    file: BANK_ENTRY,
    sha256: sha256Hex(data),
    counts: countBank(bank.questions),
  };
  const bytes = writeZip(
    [
      { name: MANIFEST_ENTRY, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
      { name: BANK_ENTRY, data },
    ],
    now,
  );
  return { name: bankZipName(now), bytes, manifest };
}

export type BankZipRead = { ok: true; text: string; manifest: BankZipManifest } | { ok: false; error: string };

function sameCounts(a: BankCounts, b: BankCounts): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Opens a backup zip and checks it end to end. The returned text goes to the normal import. */
export function readBankZip(bytes: Uint8Array): BankZipRead {
  if (!looksLikeZip(bytes)) return { ok: false, error: 'That file is not a zip file.' };
  let files: Map<string, Uint8Array>;
  try {
    files = readZip(bytes);
  } catch (e) {
    return { ok: false, error: e instanceof ZipError ? e.message : 'The zip file could not be read.' };
  }
  const m = files.get(MANIFEST_ENTRY);
  const data = files.get(BANK_ENTRY);
  if (!m || !data) return { ok: false, error: 'This zip is not a Blackbook question-bank backup (manifest.json or question_bank.json is missing).' };
  let manifest: BankZipManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(m)) as BankZipManifest;
  } catch {
    return { ok: false, error: 'The backup manifest is damaged.' };
  }
  if (manifest.format !== BANK_ZIP_FORMAT) return { ok: false, error: 'This zip is not a Blackbook question-bank backup.' };
  if (manifest.formatVersion !== BANK_ZIP_FORMAT_VERSION || manifest.bankSchemaVersion !== BANK_SCHEMA_VERSION) {
    return { ok: false, error: 'This backup was made by a different version of Blackbook and cannot be read by this one.' };
  }
  if (sha256Hex(data) !== manifest.sha256) return { ok: false, error: 'The question file inside the zip does not match its checksum. The zip is damaged.' };
  const text = new TextDecoder().decode(data);
  let parsed: { questions?: unknown };
  try {
    parsed = JSON.parse(text) as { questions?: unknown };
  } catch {
    return { ok: false, error: 'The question file inside the zip is damaged.' };
  }
  if (!Array.isArray(parsed.questions) || !sameCounts(countBank(parsed.questions), manifest.counts)) {
    return { ok: false, error: 'The number of questions inside the zip does not match its manifest. The zip is damaged.' };
  }
  return { ok: true, text, manifest };
}
