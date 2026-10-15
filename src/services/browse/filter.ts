// Browse filtering, counts per option, status derivation and random picks. Pure.

import type { BrowseFilters, BrowseRow, FilterCounts, QuestionStatus, SeenStatus } from '../../types/browse';
import type { Question } from '../../types/sat';

type Key = keyof BrowseFilters;

/** Does `row` pass the filter `key` set to `value`? */
function passes(row: BrowseRow, key: Key, value: string): boolean {
  if (value === 'all') return true;
  switch (key) {
    case 'section':
      return row.section === value;
    case 'domainCode':
      return row.domainCode === value;
    case 'skillCode':
      return row.skillCode === value;
    case 'difficulty':
      return row.difficulty === value;
    case 'format':
      return row.format === value;
    case 'source':
      return row.source === value;
    case 'live':
      return value === 'yes' ? row.active : !row.active;
    case 'status':
      if (value === 'unseen') return row.status === 'unseen';
      if (value === 'seen') return row.status !== 'unseen';
      if (value === 'done') return row.status === 'done';
      return row.status !== 'done'; // not_done
    case 'flagged':
      return row.flagged;
    case 'lastResult':
      return value === 'none' ? row.lastResult === null : row.lastResult === value;
  }
}

const KEYS: readonly Key[] = ['section', 'domainCode', 'skillCode', 'difficulty', 'format', 'source', 'live', 'status', 'flagged', 'lastResult'];

export function applyFilters(rows: readonly BrowseRow[], f: BrowseFilters): BrowseRow[] {
  return rows.filter((r) => KEYS.every((k) => passes(r, k, f[k])));
}

/** Fixed options for the filters that do not come from the bank. */
const FIXED: Partial<Record<Key, readonly string[]>> = {
  live: ['yes', 'no'],
  status: ['unseen', 'seen', 'done', 'not_done'],
  flagged: ['yes'],
  lastResult: ['correct', 'incorrect', 'none'],
};

const ROW_VALUE: Partial<Record<Key, (r: BrowseRow) => string>> = {
  section: (r) => r.section,
  domainCode: (r) => r.domainCode,
  skillCode: (r) => r.skillCode,
  difficulty: (r) => r.difficulty,
  format: (r) => r.format,
  source: (r) => r.source,
};

/**
 * Counts for every option of every filter, each computed with all the other filters applied.
 * One pass per filter over the rows, so it stays fast on the full bank.
 */
export function filterCounts(rows: readonly BrowseRow[], f: BrowseFilters): FilterCounts {
  const out = {} as FilterCounts;
  for (const key of KEYS) {
    const others = rows.filter((r) => KEYS.every((k) => k === key || passes(r, k, f[k])));
    const counts: Record<string, number> = { all: others.length };
    const fixed = FIXED[key];
    if (fixed) for (const v of fixed) counts[v] = others.filter((r) => passes(r, key, v)).length;
    const value = ROW_VALUE[key];
    if (value) {
      for (const r of rows) counts[value(r)] ??= 0;
      for (const r of others) counts[value(r)] = (counts[value(r)] ?? 0) + 1;
    }
    out[key] = counts;
  }
  return out;
}

export function seenStatus(s: QuestionStatus | undefined): SeenStatus {
  if (!s) return 'unseen';
  if (s.done) return 'done';
  return s.seen ? 'seen' : 'unseen';
}

/** Browse rows from the bank and the status list. Questions with no history are unseen. */
export function buildRows(questions: readonly Question[], status: readonly QuestionStatus[]): BrowseRow[] {
  const byId = new Map(status.map((s) => [s.questionId, s]));
  return questions.map((q) => {
    const s = byId.get(q.id);
    return {
      id: q.id,
      displayId: q.displayId,
      section: q.section,
      domainCode: q.domainCode,
      domain: q.domain,
      skillCode: q.skillCode,
      skill: q.skill,
      difficulty: q.difficulty,
      format: q.answer.kind,
      source: q.source,
      active: q.active,
      status: seenStatus(s),
      examShown: s?.examShown ?? false,
      attempts: s?.attempts ?? 0,
      lastResult: s?.lastResult ?? null,
      flagged: s?.flagged ?? false,
    };
  });
}

/** A random row from `rows`, preferring unseen ones, then seen but not done, then any. */
export function pickRandom(rows: readonly BrowseRow[], rng: () => number = Math.random): BrowseRow | null {
  for (const pool of [rows.filter((r) => r.status === 'unseen'), rows.filter((r) => r.status === 'seen'), rows]) {
    if (pool.length > 0) return pool[Math.floor(rng() * pool.length)] as BrowseRow;
  }
  return null;
}
