// The download pipeline, shared by `bun run sync` and the local app server: lookup, lists,
// dedupe (newest wins), details (cached, resumable), normalize, sanitize, and a skip report.
// It never writes the bank itself; callers swap the returned bank in atomically.
//
// Politeness comes from limits.ts and cannot be changed by callers outside tests.

import type { WindowLike } from 'dompurify';
import { BANK_SCHEMA_VERSION, type Question, type QuestionBank, type Section, type SkippedQuestion } from '../../types/sat';
import { emptyStats, mergeStats, normalizeHtml, type DomEnv } from '../normalize/html';
import { createSanitizer } from '../normalize/sanitize';
import { abortError, defaultSleep, fetchJson, HttpError, runPool } from './http';
import { LIMITS, type Limits } from './limits';
import { guardListRow, guardLookup, rowId, type RawListRow } from './raw';
import { canonicalSkillNames, dedupeRows, toQuestion } from './toQuestion';

export const API = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const SAT = 99;
const SECTION_QUERY: Record<Section, { test: number; domains: string }> = {
  rw: { test: 1, domains: 'INI,CAS,EOI,SEC' },
  math: { test: 2, domains: 'H,P,Q,S' },
};

/** Reasons that reflect a deliberate policy rather than a problem with the data or the code. */
export const EXPECTED_SKIPS: ReadonlySet<string> = new Set([
  'known-malformed',
  'legacy-spr-no-key',
  'legacy-mcq-no-key',
  'mcq-key-conflicts-rationale',
]);

/** Items the source publishes malformed (verified by hand). Skipped with a warning, not a failure. */
export const KNOWN_MALFORMED: ReadonlySet<string> = new Set(['029650-DC']); // legacy SPR, detail has no prompt

export interface CachedDetail {
  /** updateDate of the list row when this detail was fetched. */
  updatedAt: number;
  detail: unknown;
}

/** Where raw detail responses are kept between runs, so a stopped run resumes. */
export interface DetailCache {
  get(id: string): Promise<CachedDetail | null>;
  put(id: string, entry: CachedDetail): Promise<void>;
}

export interface DownloadScope {
  sections: Section[];
  /** Only questions in the source's live set. */
  liveOnly: boolean;
  /** Refetch every detail even if cached and unchanged. */
  refetchAll?: boolean;
  /** Development aid: only the first N questions per section. */
  limitPerSection?: number;
}

export type StopReason = 'cancelled' | 'blocked' | 'offline' | 'failures' | 'stalled' | 'shape';

export interface LastRequest {
  url: string;
  questionId: string | null;
  startedAt: number;
}

/** Thrown when a run stops before finishing. Nothing has been written to the bank. */
export class DownloadStopped extends Error {
  constructor(
    readonly reason: StopReason,
    message: string,
    readonly lastRequest: LastRequest | null = null,
  ) {
    super(message);
    this.name = 'DownloadStopped';
  }
}

export type PipelineStage = 'lists' | 'details' | 'normalize';

export type PipelineEvent =
  | { type: 'stage'; stage: PipelineStage }
  | { type: 'plan'; questions: number; live: number; cached: number; toFetch: number }
  | { type: 'detail'; done: number; failed: number; toFetch: number; retries: number }
  | { type: 'retry'; questionId: string | null; attempt: number; delayMs: number; error: string }
  | { type: 'normalized'; done: number; total: number };

export interface SyncReport {
  questions: number;
  bySection: Record<string, number>;
  bySectionDifficulty: Record<string, number>;
  bySource: Record<string, number>;
  active: number;
  legacyStructured: number;
  legacyExtracted: number;
  legacyMcqNoKey: number;
  legacySprNoKey: number;
  skipCounts: Record<string, number>;
  /** Skip reasons outside EXPECTED_SKIPS. Non-empty means something changed upstream. */
  unexpectedSkipReasons: string[];
  fetchFailures: number;
  mathConverted: number;
  mathKept: number;
  mathKeptReasons: Record<string, number>;
  svgCleaned: number;
  durationMs: number;
}

export interface PipelineResult {
  bank: QuestionBank;
  report: SyncReport;
  /** Questions whose answer key was read from the rationale, for spot checks. */
  extracted: Question[];
}

export interface PipelineDeps {
  fetch: typeof fetch;
  cache: DetailCache;
  /** A DOM for normalizing and sanitizing (jsdom in Bun). */
  window: WindowLike & DomEnv;
  signal?: AbortSignal;
  onEvent?: (e: PipelineEvent) => void;
  /** Test seams. Production code leaves these unset. */
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  limits?: Limits;
  /** Hands control back to the event loop during normalizing so a server stays responsive. */
  yieldNow?: () => Promise<void>;
}

function bump(m: Record<string, number>, k: string): void {
  m[k] = (m[k] ?? 0) + 1;
}

/**
 * Runs the whole download. Resolves with the bank and report, or rejects with DownloadStopped.
 * Questions in the live set are fetched first.
 */
export async function runPipeline(scope: DownloadScope, deps: PipelineDeps): Promise<PipelineResult> {
  const limits = deps.limits ?? LIMITS;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const emit = deps.onEvent ?? (() => undefined);
  const yieldNow = deps.yieldNow ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  const started = now();

  // One controller for the whole run: cancel from outside, or a stop rule from inside.
  const ctl = new AbortController();
  const signal = ctl.signal;
  const stop = (reason: StopReason, message: string) => {
    if (!signal.aborted) ctl.abort(new DownloadStopped(reason, message, lastRequest));
  };
  const onOuterAbort = () => stop('cancelled', 'Download cancelled.');
  if (deps.signal?.aborted) onOuterAbort();
  deps.signal?.addEventListener('abort', onOuterAbort, { once: true });

  // Activity tracking for the stall watchdog and the stop rules.
  let lastRequest: LastRequest | null = null;
  let lastActivity = now();
  let waitUntil = 0;
  let blockedRun = 0;
  let networkRun = 0;
  let watchdog: ReturnType<typeof setInterval> | null = null;

  const trackedFetch: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    lastRequest = { url, questionId: currentId(init), startedAt: now() };
    lastActivity = now();
    return deps.fetch(input, init).finally(() => {
      lastActivity = now();
    });
  };
  const currentId = (init: RequestInit | undefined): string | null => {
    if (typeof init?.body !== 'string') return null;
    const m = /"external_id":"([^"]+)"/.exec(init.body);
    return m ? (m[1] as string) : null;
  };

  const retryOpts = {
    attempts: limits.attempts,
    baseDelayMs: limits.baseDelayMs,
    maxDelayMs: limits.maxDelayMs,
    timeoutMs: limits.requestTimeoutMs,
    fetch: trackedFetch,
    sleep,
    random: deps.random ?? Math.random,
    onAttempt: ({ status }: { status: number | null }) => {
      if (status === null) {
        networkRun++;
        if (networkRun >= limits.networkStopAfter) {
          stop('offline', `No response from the source ${networkRun} times in a row. Check your internet connection, then try again.`);
        }
        return;
      }
      networkRun = 0;
      if (status === 403 || status === 429) {
        blockedRun++;
        if (blockedRun >= limits.blockedStopAfter) {
          stop('blocked', `The source refused requests ${blockedRun} times in a row (HTTP ${status}). The download stopped and will not retry on its own.`);
        }
      } else if (status >= 200 && status < 300) {
        blockedRun = 0;
      }
    },
  };
  let retries = 0;
  const onRetry = (questionId: string | null) => (info: { attempt: number; delayMs: number; error: string }) => {
    retries++;
    waitUntil = Math.max(waitUntil, now() + info.delayMs);
    lastActivity = now();
    emit({ type: 'retry', questionId, ...info });
  };

  const startWatchdog = () => {
    watchdog = setInterval(() => {
      const t = now();
      if (t < waitUntil) return; // a declared backoff wait is not a stall
      if (t - Math.max(lastActivity, waitUntil) >= limits.stallMs) {
        const where = lastRequest ? ` Last request: ${lastRequest.questionId ?? lastRequest.url}.` : '';
        stop('stalled', `No progress for ${Math.round(limits.stallMs / 1000)} seconds.${where}`);
      }
    }, Math.min(1000, Math.max(5, limits.stallMs / 4)));
  };
  const stopWatchdog = () => {
    if (watchdog !== null) clearInterval(watchdog);
    watchdog = null;
  };

  const rethrow = (e: unknown): never => {
    if (signal.aborted) throw signal.reason instanceof DownloadStopped ? signal.reason : abortError(signal);
    throw e;
  };

  try {
    startWatchdog();

    // 1. Lookup and lists. Any shape drift aborts the run.
    emit({ type: 'stage', stage: 'lists' });
    const lookupG = guardLookup(
      await fetchJson(`${API}/lookup`, { method: 'GET', headers: HEADERS, signal }, { ...retryOpts, onRetry: onRetry(null) }).catch(rethrow),
    );
    if (!lookupG.ok) throw new DownloadStopped('shape', `The source's lookup data changed shape (${lookupG.problem}).`);
    const activeIds = new Set([...lookupG.value.readingLiveItems, ...lookupG.value.mathLiveItems]);

    const work: { section: Section; row: RawListRow }[] = [];
    const allRows: RawListRow[] = [];
    for (const section of scope.sections) {
      const q = SECTION_QUERY[section];
      const raw = await fetchJson(
        `${API}/digital/get-questions`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify({ asmtEventId: SAT, test: q.test, domain: q.domains }), signal },
        { ...retryOpts, onRetry: onRetry(null) },
      ).catch(rethrow);
      if (!Array.isArray(raw)) throw new DownloadStopped('shape', `The question list for ${section} is not a list any more.`);
      const rows: RawListRow[] = [];
      const problems = new Map<string, number>();
      for (const r of raw) {
        const g = guardListRow(r);
        if (g.ok) rows.push(g.value);
        else problems.set(g.problem, (problems.get(g.problem) ?? 0) + 1);
      }
      if (problems.size > 0) {
        const detail = [...problems].map(([p, n]) => `${n}x ${p}`).join('; ');
        throw new DownloadStopped('shape', `Question list rows for ${section} changed shape: ${detail}`);
      }
      const unique = dedupeRows(rows);
      allRows.push(...unique);
      const inScope = scope.liveOnly ? unique.filter((r) => activeIds.has(rowId(r))) : unique;
      const limited = scope.limitPerSection === undefined ? inScope : inScope.slice(0, scope.limitPerSection);
      for (const row of limited) work.push({ section, row });
    }
    const skillNames = canonicalSkillNames(allRows);

    // 2. Details: live-set questions first, then the rest. Only missing or changed ones are fetched.
    emit({ type: 'stage', stage: 'details' });
    const cache = new Map<string, CachedDetail>();
    const toFetch: RawListRow[] = [];
    for (const { row } of work) {
      const c = scope.refetchAll ? null : await deps.cache.get(rowId(row));
      // Reading the local cache is progress too: a cold disk can take longer than the stall limit.
      lastActivity = now();
      if (c !== null && c.updatedAt >= row.updateDate) cache.set(rowId(row), c);
      else toFetch.push(row);
    }
    toFetch.sort((a, b) => Number(activeIds.has(rowId(b))) - Number(activeIds.has(rowId(a))));
    const live = work.filter((w) => activeIds.has(rowId(w.row))).length;
    emit({ type: 'plan', questions: work.length, live, cached: cache.size, toFetch: toFetch.length });

    const fetchFailures: SkippedQuestion[] = [];
    let fetched = 0;
    let failedRun = 0;
    await runPool(toFetch, {
      concurrency: limits.maxInFlight,
      minGapMs: limits.minGapMs,
      sleep,
      now,
      signal,
      worker: async (row) => {
        const id = rowId(row);
        const detail = await fetchJson(
          `${API}/digital/get-question`,
          { method: 'POST', headers: HEADERS, body: JSON.stringify({ external_id: id }), signal },
          { ...retryOpts, onRetry: onRetry(id) },
        );
        const entry: CachedDetail = { updatedAt: row.updateDate, detail };
        await deps.cache.put(id, entry);
        cache.set(id, entry);
        fetched++;
        failedRun = 0;
        emit({ type: 'detail', done: fetched + fetchFailures.length, failed: fetchFailures.length, toFetch: toFetch.length, retries });
      },
      onError: (row, e) => {
        if (signal.aborted) return;
        const reason = e instanceof HttpError ? `http ${e.status}` : `fetch failed: ${e instanceof Error ? e.message : String(e)}`;
        fetchFailures.push({ id: rowId(row), reason });
        failedRun++;
        emit({ type: 'detail', done: fetched + fetchFailures.length, failed: fetchFailures.length, toFetch: toFetch.length, retries });
        if (failedRun >= limits.failuresStopAfter) stop('failures', `${failedRun} questions in a row could not be downloaded (last: ${reason}).`);
      },
    });
    if (signal.aborted) rethrow(null);
    stopWatchdog();

    // 3. Normalize. CPU-bound, so it yields regularly and still honours cancel.
    emit({ type: 'stage', stage: 'normalize' });
    const sanitize = createSanitizer(deps.window);
    const env: DomEnv = { DOMParser: deps.window.DOMParser };
    const textOf = (html: string): string => new deps.window.DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
    const questions: Question[] = [];
    const extracted: Question[] = [];
    const skipped: SkippedQuestion[] = [...fetchFailures];
    const skipCounts: Record<string, number> = {};
    const stats = emptyStats();
    let legacyStructured = 0;
    for (const [i, { section, row }] of work.entries()) {
      if (signal.aborted) rethrow(null);
      if (i % 10 === 0) await yieldNow();
      const id = rowId(row);
      const c = cache.get(id);
      if (c !== undefined) {
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
          bump(skipCounts, r.reason === 'detail-shape' && KNOWN_MALFORMED.has(id) ? 'known-malformed' : r.reason);
        }
      }
      if ((i + 1) % 25 === 0 || i + 1 === work.length) emit({ type: 'normalized', done: i + 1, total: work.length });
    }

    const bank: QuestionBank = { schemaVersion: BANK_SCHEMA_VERSION, fetchedAt: new Date(now()).toISOString(), questions, skipped };
    const bySection: Record<string, number> = {};
    const bySectionDifficulty: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const q of questions) {
      bump(bySection, q.section);
      bump(bySectionDifficulty, `${q.section}/${q.difficulty}`);
      bump(bySource, q.source);
    }
    const keptReasons: Record<string, number> = {};
    for (const r of stats.mathKeptReasons) bump(keptReasons, r.slice(0, 80));
    const report: SyncReport = {
      questions: questions.length,
      bySection,
      bySectionDifficulty,
      bySource,
      active: questions.filter((q) => q.active).length,
      legacyStructured,
      legacyExtracted: extracted.length,
      legacyMcqNoKey: skipCounts['legacy-mcq-no-key'] ?? 0,
      legacySprNoKey: skipCounts['legacy-spr-no-key'] ?? 0,
      skipCounts,
      unexpectedSkipReasons: Object.keys(skipCounts).filter((k) => !EXPECTED_SKIPS.has(k)),
      fetchFailures: fetchFailures.length,
      mathConverted: stats.mathConverted,
      mathKept: stats.mathKept,
      mathKeptReasons: keptReasons,
      svgCleaned: stats.svgCleaned,
      durationMs: now() - started,
    };
    return { bank, report, extracted };
  } catch (e) {
    if (signal.aborted && signal.reason instanceof DownloadStopped) throw signal.reason;
    throw e;
  } finally {
    stopWatchdog();
    deps.signal?.removeEventListener('abort', onOuterAbort);
  }
}
