import { describe, expect, it } from 'vitest';
import type { Question } from '../../types/sat';
import { createSanitizer } from '../normalize/sanitize';
import { MemoryQuestionStore } from '../storage/memory';
import { importBankText, type ImportStage } from './importBank';

// Synthetic questions only (AGENTS.md rule 1).
const q = (id: string, over: Partial<Question> = {}): Question => ({
  id,
  source: 'digital',
  displayId: `d${id}`,
  section: 'rw',
  domainCode: 'CAS',
  domain: 'Craft and Structure',
  skillCode: 'WIC',
  skill: 'Words in Context',
  difficulty: 'M',
  scoreBand: 4,
  active: false,
  stimulusHtml: '<p>The tide came in slowly.</p>',
  stemHtml: '<p>Which word best fits?</p>',
  answer: { kind: 'mcq', choices: ['<p>calm</p>', '<p>loud</p>', '<p>red</p>', '<p>late</p>'], correct: 'A', keyOrigin: 'structured' },
  rationaleHtml: '<p>Choice A is correct.</p>',
  updatedAt: 1,
  ...over,
});

const file = (questions: unknown[], extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ schemaVersion: 1, fetchedAt: '2026-10-14T00:00:00.000Z', questions, skipped: [{ id: 'x', reason: 'legacy-spr-no-key' }], ...extra });

const sanitize = createSanitizer(window);
const now = () => new Date('2026-10-15T00:00:00.000Z');

describe('importBankText', () => {
  it('imports valid questions, stores metadata and reports progress', async () => {
    const store = new MemoryQuestionStore();
    const stages = new Set<ImportStage>();
    const r = await importBankText(file([q('1'), q('2')]), { store, sanitize, now, onProgress: (s) => stages.add(s) });
    expect(r).toEqual({ ok: true, imported: 2, skippedBySync: 1, invalid: [] });
    expect(await store.count()).toBe(2);
    expect(await store.getMeta()).toEqual({
      fetchedAt: '2026-10-14T00:00:00.000Z',
      importedAt: '2026-10-15T00:00:00.000Z',
      count: 2,
      skippedCount: 1,
    });
    expect([...stages]).toEqual(['reading', 'validating', 'saving']);
  });

  it('re-sanitizes every HTML field from the file', async () => {
    const store = new MemoryQuestionStore();
    const evil = '<p onclick="x()">hi<script>alert(1)</script></p>';
    await importBankText(
      file([q('1', { stimulusHtml: evil, stemHtml: evil, rationaleHtml: evil, answer: { kind: 'mcq', choices: [evil, 'b', 'c', 'd'], correct: 'A', keyOrigin: 'structured' } })]),
      { store, sanitize },
    );
    const stored = await store.get('1');
    const all = JSON.stringify(stored);
    expect(all).not.toMatch(/script|onclick/);
    expect(stored?.stemHtml).toBe('<p>hi</p>');
  });

  it('keeps good questions and lists bad ones with reasons', async () => {
    const store = new MemoryQuestionStore();
    const r = await importBankText(file([q('1'), { ...q('2'), difficulty: 'X' }, 'junk']), { store, sanitize });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.imported).toBe(1);
      expect(r.invalid.map((i) => [i.index, i.id])).toEqual([
        [1, '2'],
        [2, null],
      ]);
      expect(r.invalid[0]?.errors[0]).toContain('difficulty');
    }
  });

  it('rejects malformed files without touching the current bank', async () => {
    const store = new MemoryQuestionStore();
    await importBankText(file([q('keep')]), { store, sanitize });
    for (const bad of ['{not json', '[]', JSON.stringify({ schemaVersion: 9, fetchedAt: 'x', questions: [] }), file([{}])]) {
      const r = await importBankText(bad, { store, sanitize });
      expect(r.ok).toBe(false);
    }
    expect((await store.get('keep'))?.id).toBe('keep');
  });

  it('keeps the previous bank when saving fails', async () => {
    const store = new MemoryQuestionStore();
    await importBankText(file([q('keep')]), { store, sanitize });
    const failing = Object.assign(Object.create(store) as MemoryQuestionStore, {
      replaceAll: async () => {
        throw new Error('quota');
      },
    });
    const r = await importBankText(file([q('new')]), { store: failing, sanitize });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toContain('previous bank was kept');
    expect(await store.count()).toBe(1);
  });
});
