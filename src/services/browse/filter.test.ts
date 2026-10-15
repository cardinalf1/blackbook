import { describe, expect, it } from 'vitest';
import { DEFAULT_BROWSE_FILTERS, type BrowseFilters, type BrowseRow } from '../../types/browse';
import { applyFilters, filterCounts, pickRandom, seenStatus } from './filter';

// Synthetic rows only.
function makeRows(): BrowseRow[] {
  const rows: BrowseRow[] = [];
  const statuses = ['unseen', 'seen', 'done'] as const;
  for (let i = 0; i < 60; i++) {
    const status = statuses[i % 3] as BrowseRow['status'];
    rows.push({
      id: `q${i}`,
      displayId: `d${i}`,
      section: i % 2 === 0 ? 'rw' : 'math',
      domainCode: `D${i % 4}`,
      domain: `Domain ${i % 4}`,
      skillCode: `S${i % 6}`,
      skill: `Skill ${i % 6}`,
      difficulty: (['E', 'M', 'H'] as const)[i % 3] as BrowseRow['difficulty'],
      format: i % 5 === 0 ? 'spr' : 'mcq',
      source: i % 7 === 0 ? 'legacy' : 'digital',
      active: i % 4 !== 0,
      status,
      examShown: false,
      attempts: status === 'done' ? 1 + (i % 2) : 0,
      lastResult: status === 'done' ? (i % 2 === 0 ? 'correct' : 'incorrect') : null,
      flagged: i % 10 === 0,
    });
  }
  return rows;
}

const rows = makeRows();
const f = (over: Partial<BrowseFilters>): BrowseFilters => ({ ...DEFAULT_BROWSE_FILTERS, ...over });

describe('browse filters', () => {
  it('status filters: seen includes done, not done includes unseen', () => {
    const count = (status: BrowseFilters['status']) => applyFilters(rows, f({ status })).length;
    expect(count('unseen')).toBe(20);
    expect(count('seen')).toBe(40);
    expect(count('done')).toBe(20);
    expect(count('not_done')).toBe(40);
    expect(count('all')).toBe(60);
  });

  it('combines filters', () => {
    const got = applyFilters(rows, f({ section: 'rw', status: 'done', lastResult: 'correct' }));
    expect(got.every((r) => r.section === 'rw' && r.status === 'done' && r.lastResult === 'correct')).toBe(true);
    expect(got.length).toBe(rows.filter((r) => r.section === 'rw' && r.status === 'done' && r.lastResult === 'correct').length);
    expect(applyFilters(rows, f({ lastResult: 'none' })).every((r) => r.lastResult === null)).toBe(true);
    expect(applyFilters(rows, f({ flagged: 'yes' })).map((r) => r.id)).toEqual(['q0', 'q10', 'q20', 'q30', 'q40', 'q50']);
  });

  it('counts each option with every other filter applied, matching a brute force', () => {
    const filters = f({ section: 'math', status: 'not_done', difficulty: 'H' });
    const counts = filterCounts(rows, filters);
    for (const [key, options] of Object.entries(counts) as [keyof BrowseFilters, Record<string, number>][]) {
      for (const [value, n] of Object.entries(options)) {
        expect(applyFilters(rows, { ...filters, [key]: value }).length, `${key}=${value}`).toBe(n);
      }
    }
    expect(counts.status.done).toBe(applyFilters(rows, { ...filters, status: 'done' }).length);
    expect(counts.domainCode).toHaveProperty('D0'); // present even when 0
  });

  it('random prefers unseen, then seen, then anything', () => {
    expect(pickRandom(rows, () => 0.99)?.status).toBe('unseen');
    expect(pickRandom(rows.filter((r) => r.status !== 'unseen'), () => 0)?.status).toBe('seen');
    expect(pickRandom(rows.filter((r) => r.status === 'done'), () => 0)?.status).toBe('done');
    expect(pickRandom([])).toBeNull();
  });

  it('derives the badge from status', () => {
    expect(seenStatus(undefined)).toBe('unseen');
    expect(seenStatus({ questionId: 'x', seen: true, done: false, examShown: false, attempts: 0, lastResult: null, flagged: false })).toBe('seen');
    expect(seenStatus({ questionId: 'x', seen: true, done: true, examShown: false, attempts: 1, lastResult: null, flagged: false })).toBe('done');
  });
});
