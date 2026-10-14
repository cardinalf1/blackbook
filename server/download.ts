// Runs one download at a time in the local process and keeps a progress snapshot that the UI
// watches. A run only replaces the bank after the whole pipeline succeeds; cancel or failure
// leaves the previous bank untouched. Questions outside the chosen scope are kept.

import { describeSkips } from '../src/services/download/estimate';
import { DownloadStopped, runPipeline, type PipelineDeps, type PipelineEvent } from '../src/services/sync/pipeline';
import type { WritableQuestionStore } from '../src/services/storage/types';
import type { DownloadFailureReason, DownloadProgress, DownloadScopeChoice } from '../src/types/download';
import type { Question, Section, SkippedQuestion } from '../src/types/sat';
import type { FsDetailCache } from './files';

/** Measured normalize cost per question, used for the time-left estimate. */
const NORMALIZE_SECONDS_PER_ITEM = 0.09;

export interface DownloadManagerDeps {
  bank: WritableQuestionStore & { getSkipped(): Promise<SkippedQuestion[]> };
  cache: FsDetailCache;
  window: PipelineDeps['window'];
  fetch: typeof fetch;
  dataFolder: string;
  now?: () => number;
  /** Test seam: passed straight to the pipeline. */
  pipeline?: Partial<Pick<PipelineDeps, 'limits' | 'sleep' | 'yieldNow'>>;
}

type Listener = (p: DownloadProgress) => void;

function storageMessage(e: unknown): string | null {
  const code = (e as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOSPC') return 'The disk is full. Free some space, then retry. Your previous questions were not changed.';
  if (code === 'EACCES' || code === 'EPERM') return 'Blackbook is not allowed to write to its data folder. Your previous questions were not changed.';
  return null;
}

/** Keeps questions the chosen scope did not cover, so a narrower refresh never shrinks the bank. */
export function mergeOutsideScope(existing: readonly Question[], downloaded: readonly Question[], scope: DownloadScopeChoice): Question[] {
  const inScope = (q: Question) => scope.sections.includes(q.section) && (!scope.liveOnly || q.active);
  const fresh = new Set(downloaded.map((q) => q.id));
  return [...downloaded, ...existing.filter((q) => !inScope(q) && !fresh.has(q.id))];
}

export class DownloadManager {
  private progress: DownloadProgress;
  private ctl: AbortController | null = null;
  private listeners = new Set<Listener>();
  private detailsStartedAt: number | null = null;
  private running: Promise<void> | null = null;

  constructor(private readonly deps: DownloadManagerDeps) {
    this.progress = this.blank('idle');
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private blank(status: DownloadProgress['status']): DownloadProgress {
    return {
      status,
      scope: null,
      stage: null,
      questions: 0,
      cached: 0,
      toFetch: 0,
      fetched: 0,
      failed: 0,
      retries: 0,
      normalized: 0,
      startedAt: null,
      updatedAt: this.now(),
      etaSeconds: null,
      error: null,
      summary: null,
      cache: { bytes: 0, files: 0 },
      dataFolder: this.deps.dataFolder,
    };
  }

  snapshot(): DownloadProgress {
    return this.progress;
  }

  isRunning(): boolean {
    return this.progress.status === 'running';
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private update(patch: Partial<DownloadProgress>): void {
    this.progress = { ...this.progress, ...patch, updatedAt: this.now() };
    this.progress.etaSeconds = this.eta();
    for (const fn of this.listeners) fn(this.progress);
  }

  private eta(): number | null {
    const p = this.progress;
    if (p.status !== 'running') return null;
    const normalizeLeft = Math.max(0, p.questions - p.normalized) * NORMALIZE_SECONDS_PER_ITEM;
    if (p.stage === 'normalize' || p.stage === 'saving') return Math.round(normalizeLeft);
    if (p.stage !== 'details' || this.detailsStartedAt === null) return null;
    const done = p.fetched + p.failed;
    if (done < 5) return null;
    const rate = done / Math.max(1, (this.now() - this.detailsStartedAt) / 1000);
    return Math.round((p.toFetch - done) / rate + normalizeLeft);
  }

  async refreshCacheSize(): Promise<void> {
    this.update({ cache: await this.deps.cache.size() });
  }

  /** Starts a run in the background. Returns false if one is already running. */
  start(scope: DownloadScopeChoice): boolean {
    if (this.isRunning()) return false;
    if (scope.sections.length === 0) return false;
    this.ctl = new AbortController();
    this.detailsStartedAt = null;
    this.progress = { ...this.blank('running'), scope, startedAt: this.now(), cache: this.progress.cache };
    this.update({ stage: 'lists' });
    this.running = this.run(scope, this.ctl.signal).finally(() => {
      this.running = null;
      this.ctl = null;
    });
    return true;
  }

  cancel(): void {
    this.ctl?.abort();
  }

  /** Resolves when the current run (if any) has fully stopped. */
  async settled(): Promise<void> {
    await this.running;
  }

  async freeCache(): Promise<void> {
    if (this.isRunning()) throw new Error('A download is running.');
    await this.deps.cache.clear();
    await this.refreshCacheSize();
  }

  private onEvent = (e: PipelineEvent): void => {
    switch (e.type) {
      case 'stage':
        if (e.stage === 'details') this.detailsStartedAt = this.now();
        this.update({ stage: e.stage });
        break;
      case 'plan':
        this.update({ questions: e.questions, cached: e.cached, toFetch: e.toFetch });
        break;
      case 'detail':
        this.update({ fetched: e.done - e.failed, failed: e.failed, retries: e.retries });
        break;
      case 'retry':
        this.update({ retries: this.progress.retries + 1 });
        break;
      case 'normalized':
        this.update({ normalized: e.done });
        break;
    }
  };

  private async run(scope: DownloadScopeChoice, signal: AbortSignal): Promise<void> {
    try {
      const result = await runPipeline(
        { sections: scope.sections, liveOnly: scope.liveOnly },
        { fetch: this.deps.fetch, cache: this.deps.cache, window: this.deps.window, signal, onEvent: this.onEvent, ...this.deps.pipeline },
      );
      if (signal.aborted) throw new DownloadStopped('cancelled', 'Download cancelled.');
      this.update({ stage: 'saving' });
      const existing = await this.deps.bank.query({});
      const questions = mergeOutsideScope(existing, result.bank.questions, scope);
      const skipped = result.bank.skipped;
      await this.deps.bank.replaceAll(
        questions,
        { fetchedAt: result.bank.fetchedAt, importedAt: new Date(this.now()).toISOString(), count: questions.length, skippedCount: skipped.length },
        undefined,
        signal,
        skipped,
      );
      const bySection: Partial<Record<Section, number>> = {};
      for (const q of result.bank.questions) bySection[q.section] = (bySection[q.section] ?? 0) + 1;
      this.update({
        status: 'succeeded',
        stage: null,
        summary: {
          questions: result.bank.questions.length,
          bySection,
          live: result.bank.questions.filter((q) => q.active).length,
          skipped: describeSkips(skipped),
          durationMs: this.now() - (this.progress.startedAt ?? this.now()),
        },
      });
    } catch (e) {
      if (e instanceof DownloadStopped && e.reason === 'cancelled') {
        this.update({ status: 'cancelled', stage: null });
      } else {
        const reason: DownloadFailureReason =
          e instanceof DownloadStopped ? (e.reason === 'cancelled' ? 'error' : e.reason) : storageMessage(e) ? 'storage' : 'error';
        const message =
          e instanceof DownloadStopped ? e.message : (storageMessage(e) ?? `Something went wrong: ${e instanceof Error ? e.message : String(e)}`);
        const lastRequest = e instanceof DownloadStopped && e.lastRequest ? (e.lastRequest.questionId ?? e.lastRequest.url) : null;
        this.update({ status: 'failed', stage: null, error: { reason, message, lastRequest } });
      }
    } finally {
      await this.refreshCacheSize().catch(() => undefined);
    }
  }
}
