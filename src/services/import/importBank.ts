// Browser import of data/question_bank.json: parse, validate, re-sanitize (the file is untrusted),
// then replace the stored bank. Pure apart from the injected store and sanitizer.

import type { Answer, Question } from '../../types/sat';
import { validateBank } from '../bank/validate';
import type { Sanitizer } from '../normalize/sanitize';
import type { QuestionStore } from '../storage/types';

export type ImportStage = 'reading' | 'validating' | 'saving';
export type ImportProgress = (stage: ImportStage, done: number, total: number) => void;

export interface InvalidEntry {
  index: number;
  id: string | null;
  errors: string[];
}

export type ImportResult =
  | { ok: true; imported: number; skippedBySync: number; invalid: InvalidEntry[] }
  | { ok: false; error: string; invalid: InvalidEntry[]; cancelled?: true };

/** How long the import may run before it hands the thread back to the browser. */
const SLICE_MS = 25;

const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const CANCELLED: ImportResult = {
  ok: false,
  error: 'Import cancelled. The previous bank was kept.',
  invalid: [],
  cancelled: true,
};

function sanitizeAnswer(a: Answer, sanitize: Sanitizer): Answer {
  if (a.kind === 'spr') return a;
  const [c0, c1, c2, c3] = a.choices.map(sanitize) as [string, string, string, string];
  return { ...a, choices: [c0, c1, c2, c3] };
}

function sanitizeQuestion(q: Question, sanitize: Sanitizer): Question {
  return {
    ...q,
    stimulusHtml: q.stimulusHtml === null ? null : sanitize(q.stimulusHtml),
    stemHtml: sanitize(q.stemHtml),
    rationaleHtml: sanitize(q.rationaleHtml),
    answer: sanitizeAnswer(q.answer, sanitize),
  };
}

export async function importBankText(
  text: string,
  deps: {
    store: QuestionStore;
    sanitize: Sanitizer;
    onProgress?: ImportProgress;
    now?: () => Date;
    /** Abort to cancel. Nothing is replaced unless the whole import succeeds. */
    signal?: AbortSignal;
    /** Replaced in tests. Default waits one macrotask so the page can paint and handle clicks. */
    yieldToBrowser?: () => Promise<void>;
    clock?: () => number;
  },
): Promise<ImportResult> {
  const pause = deps.yieldToBrowser ?? yieldToBrowser;
  const clock = deps.clock ?? (() => performance.now());
  deps.onProgress?.('reading', 0, 1);
  await pause(); // let the "Reading" state paint before the synchronous parse
  if (deps.signal?.aborted) return CANCELLED;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`, invalid: [] };
  }

  const v = validateBank(parsed);
  if (!v.ok) return { ok: false, error: `Not a Blackbook question bank: ${v.errors.join('; ')}`, invalid: [] };
  const { questions, invalid, skipped, fetchedAt } = v.value;
  if (questions.length === 0) {
    return { ok: false, error: 'The file has no valid questions. The current bank was not changed.', invalid };
  }

  const clean: Question[] = [];
  let sliceStart = clock();
  for (const [i, q] of questions.entries()) {
    clean.push(sanitizeQuestion(q, deps.sanitize));
    if (clock() - sliceStart >= SLICE_MS || i + 1 === questions.length) {
      deps.onProgress?.('validating', i + 1, questions.length);
      await pause();
      if (deps.signal?.aborted) return CANCELLED;
      sliceStart = clock();
    }
  }

  try {
    await deps.store.replaceAll(
      clean,
      {
        fetchedAt,
        importedAt: (deps.now?.() ?? new Date()).toISOString(),
        count: clean.length,
        skippedCount: skipped.length,
      },
      (done, total) => deps.onProgress?.('saving', done, total),
      deps.signal,
    );
  } catch (e) {
    if (deps.signal?.aborted) return CANCELLED;
    return {
      ok: false,
      error: `Saving failed, the previous bank was kept: ${e instanceof Error ? e.message : String(e)}`,
      invalid,
    };
  }
  return { ok: true, imported: clean.length, skippedBySync: skipped.length, invalid };
}
