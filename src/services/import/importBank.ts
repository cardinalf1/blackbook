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
  | { ok: false; error: string; invalid: InvalidEntry[] };

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
  deps: { store: QuestionStore; sanitize: Sanitizer; onProgress?: ImportProgress; now?: () => Date },
): Promise<ImportResult> {
  deps.onProgress?.('reading', 0, 1);
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
  for (const [i, q] of questions.entries()) {
    clean.push(sanitizeQuestion(q, deps.sanitize));
    if ((i + 1) % 200 === 0 || i + 1 === questions.length) deps.onProgress?.('validating', i + 1, questions.length);
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
    );
  } catch (e) {
    return {
      ok: false,
      error: `Saving failed, the previous bank was kept: ${e instanceof Error ? e.message : String(e)}`,
      invalid,
    };
  }
  return { ok: true, imported: clean.length, skippedBySync: skipped.length, invalid };
}
