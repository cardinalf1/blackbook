import { describe, expect, it } from 'vitest';
import { validateBank, validateQuestion } from './validate';

// Synthetic question. Invented content only (AGENTS.md rule 1).
const base = {
  id: 'syn-0001',
  source: 'digital',
  displayId: 'aa00bb11',
  section: 'math',
  domainCode: 'H',
  domain: 'Algebra',
  skillCode: 'H.A.',
  skill: 'Linear equations in one variable',
  difficulty: 'E',
  scoreBand: 2,
  active: false,
  stimulusHtml: null,
  stemHtml: '<p>What value of x satisfies 2x = 10?</p>',
  answer: { kind: 'mcq', choices: ['2', '5', '8', '20'], correct: 'B', keyOrigin: 'structured' },
  rationaleHtml: '<p>Dividing both sides by 2 gives x = 5.</p>',
  updatedAt: 1700000000000,
};

describe('validateQuestion', () => {
  it('accepts a valid mcq question', () => {
    const r = validateQuestion(base);
    expect(r.ok).toBe(true);
  });

  it('accepts a valid spr question', () => {
    const r = validateQuestion({ ...base, answer: { kind: 'spr', accepted: ['5', '5.0'] } });
    expect(r.ok).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(validateQuestion(null).ok).toBe(false);
    expect(validateQuestion('x').ok).toBe(false);
    expect(validateQuestion([]).ok).toBe(false);
  });

  it('reports every bad field', () => {
    const r = validateQuestion({ ...base, id: '', difficulty: 'X', scoreBand: 9, section: 'science' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('id'),
          expect.stringContaining('difficulty'),
          expect.stringContaining('scoreBand'),
          expect.stringContaining('section'),
        ]),
      );
    }
  });

  it('rejects mcq without exactly four choices or with a bad key', () => {
    expect(validateQuestion({ ...base, answer: { ...base.answer, choices: ['1', '2', '3'] } }).ok).toBe(false);
    expect(validateQuestion({ ...base, answer: { ...base.answer, correct: 'E' } }).ok).toBe(false);
    expect(validateQuestion({ ...base, answer: { ...base.answer, keyOrigin: 'guess' } }).ok).toBe(false);
  });

  it('rejects spr with no accepted answers', () => {
    expect(validateQuestion({ ...base, answer: { kind: 'spr', accepted: [] } }).ok).toBe(false);
    expect(validateQuestion({ ...base, answer: { kind: 'spr', accepted: [''] } }).ok).toBe(false);
  });
});

describe('validateBank', () => {
  const bank = { schemaVersion: 1, fetchedAt: '2026-10-14T00:00:00.000Z', questions: [base], skipped: [] };

  it('accepts a valid bank', () => {
    const r = validateBank(bank);
    expect(r.ok && r.value.questions.length).toBe(1);
  });

  it('rejects a wrong envelope', () => {
    expect(validateBank({ ...bank, schemaVersion: 2 }).ok).toBe(false);
    expect(validateBank({ ...bank, questions: 'nope' }).ok).toBe(false);
    expect(validateBank(42).ok).toBe(false);
  });

  it('reports invalid and duplicate questions individually', () => {
    const r = validateBank({ ...bank, questions: [base, { ...base }, { ...base, id: 'syn-0002', difficulty: 'Z' }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.questions).toHaveLength(1);
      expect(r.value.invalid.map((i) => i.index)).toEqual([1, 2]);
      expect(r.value.invalid[0]?.errors).toEqual(['id: duplicate']);
    }
  });
});
