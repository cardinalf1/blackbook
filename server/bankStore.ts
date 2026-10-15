// The question bank on disk: one JSON file holding the bank and its metadata, so a swap is a
// single atomic rename. Loaded into memory once and served from there.

import { readFile, rm } from 'node:fs/promises';
import { matchesQuery, type BankMeta, type ProgressFn, type QuestionQuery, type WritableQuestionStore } from '../src/services/storage/types';
import type { Question, SkippedQuestion } from '../src/types/sat';
import { toMetaRow, type QuestionMetaRow } from './analytics';
import { writeAtomic } from './files';

export const BANK_FILE_VERSION = 1;

interface BankFile {
  version: typeof BANK_FILE_VERSION;
  meta: BankMeta;
  questions: Question[];
  skipped: SkippedQuestion[];
}

interface Loaded {
  meta: BankMeta;
  questions: Question[];
  byId: Map<string, Question>;
  skipped: SkippedQuestion[];
}

export class DiskBankStore implements WritableQuestionStore {
  private loaded: Loaded | null = null;
  private loading: Promise<void> | null = null;

  constructor(readonly path: string) {}

  private async load(): Promise<Loaded> {
    if (this.loaded) return this.loaded;
    this.loading ??= (async () => {
      let file: BankFile | null = null;
      try {
        const parsed = JSON.parse(await readFile(this.path, 'utf8')) as Partial<BankFile>;
        if (parsed.version === BANK_FILE_VERSION && Array.isArray(parsed.questions) && parsed.meta) file = parsed as BankFile;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      this.set(file);
    })().finally(() => {
      this.loading = null;
    });
    await this.loading;
    if (!this.loaded) throw new Error('Question bank failed to load.');
    return this.loaded;
  }

  private set(file: BankFile | null): void {
    const questions = file?.questions ?? [];
    this.loaded = {
      meta: file?.meta ?? { fetchedAt: '', importedAt: '', count: 0, skippedCount: 0 },
      questions,
      byId: new Map(questions.map((q) => [q.id, q])),
      skipped: file?.skipped ?? [],
    };
    this.hasBank = file !== null;
  }

  private hasBank = false;

  /** Writes the new bank to a temporary file, then renames it over the old one. */
  async replaceAll(questions: readonly Question[], meta: BankMeta, onProgress?: ProgressFn, signal?: AbortSignal, skipped: readonly SkippedQuestion[] = []): Promise<void> {
    signal?.throwIfAborted();
    const file: BankFile = { version: BANK_FILE_VERSION, meta, questions: [...questions], skipped: [...skipped] };
    const text = JSON.stringify(file);
    signal?.throwIfAborted();
    await writeAtomic(this.path, text);
    this.set(file);
    onProgress?.(questions.length, questions.length);
  }

  async count(): Promise<number> {
    return (await this.load()).questions.length;
  }

  async get(id: string): Promise<Question | undefined> {
    return (await this.load()).byId.get(id);
  }

  async query(query: QuestionQuery): Promise<Question[]> {
    return (await this.load()).questions.filter((q) => matchesQuery(q, query));
  }

  /** Question facts for analytics (no content), with a signature that changes whenever the bank does. */
  async analyticsMeta(): Promise<{ signature: string; rows: QuestionMetaRow[] }> {
    const loaded = await this.load();
    const signature = `${loaded.meta.fetchedAt}|${loaded.meta.importedAt}|${loaded.questions.length}`;
    if (this.metaCache?.signature !== signature) this.metaCache = { signature, rows: loaded.questions.map(toMetaRow) };
    return this.metaCache;
  }

  private metaCache: { signature: string; rows: QuestionMetaRow[] } | null = null;

  async getMeta(): Promise<BankMeta | null> {
    const loaded = await this.load();
    return this.hasBank ? loaded.meta : null;
  }

  async getSkipped(): Promise<SkippedQuestion[]> {
    return (await this.load()).skipped;
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true });
    this.set(null);
  }
}
