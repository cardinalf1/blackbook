import { describe, expect, it } from 'vitest';
import { validateQuestion } from '../bank/validate';
import type { RawListRow } from './raw';
import { canonicalSkillNames, choiceFromRationale, dedupeRows, toQuestion, type MapContext } from './toQuestion';

// Invented raw responses shaped like docs/api-notes.md (AGENTS.md rule 1).
const textOf = (html: string): string => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
const ctx: MapContext = {
  section: 'math',
  activeIds: new Set(['d-1']),
  skillNames: new Map([['H.A.', 'Linear equations in one variable']]),
  html: (h) => h,
  textOf,
};

function row(over: Partial<RawListRow> = {}): RawListRow {
  return {
    questionId: 'abc12345',
    external_id: 'd-1',
    ibn: null,
    primary_class_cd: 'H',
    primary_class_cd_desc: 'Algebra',
    skill_cd: 'H.A.',
    skill_desc: 'linear equations in one variable',
    difficulty: 'M',
    score_band_range_cd: 4,
    updateDate: 1000,
    ...over,
  };
}

const digitalMcq = {
  type: 'mcq',
  stem: '<p>If 3x = 12, what is x?</p>',
  answerOptions: [
    { id: 'o1', content: '<p>2</p>' },
    { id: 'o2', content: '<p>4</p>' },
    { id: 'o3', content: '<p>6</p>' },
    { id: 'o4', content: '<p>9</p>' },
  ],
  correct_answer: ['B'],
  keys: ['o2'],
  rationale: '<p>Choice B is correct. Dividing by 3 gives 4.</p>',
};

const legacy = (answer: Record<string, unknown>) => ({
  item_id: 'L-1-DC',
  section: 'Math',
  prompt: '<p>Which value is largest?</p>',
  answer: {
    style: 'Multiple Choice',
    choices: { a: { body: '1' }, b: { body: '2' }, c: { body: '3' }, d: { body: '4' } },
    rationale: '<p>Choice D is correct. It is the largest. Choice A is incorrect because it is smallest.</p>',
    ...answer,
  },
});
const legacyRow = row({ external_id: null, ibn: 'L-1-DC' });

describe('choiceFromRationale', () => {
  it('returns the letter when stated exactly once', () => {
    expect(choiceFromRationale('Choice C is correct. Choice A is incorrect.')).toBe('C');
  });
  it('returns null when absent, repeated or contradictory', () => {
    expect(choiceFromRationale('The answer is C.')).toBeNull();
    expect(choiceFromRationale('Choice C is correct. Again, Choice C is correct.')).toBeNull();
    expect(choiceFromRationale('Choice A is correct. Choice B is correct.')).toBeNull();
  });
  it('does not match lowercase or other wording', () => {
    expect(choiceFromRationale('choice C is correct')).toBeNull();
    expect(choiceFromRationale('Choice C is the best answer')).toBeNull();
  });
});

describe('toQuestion: digital', () => {
  it('maps a digital mcq to a valid Question', () => {
    const r = toQuestion(row(), digitalMcq, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(validateQuestion(r.question).ok).toBe(true);
    expect(r.question).toMatchObject({
      id: 'd-1',
      source: 'digital',
      skill: 'Linear equations in one variable',
      active: true,
      stimulusHtml: null,
      answer: { kind: 'mcq', correct: 'B', keyOrigin: 'structured' },
    });
  });

  it('maps a digital spr with several accepted answers', () => {
    const r = toQuestion(row(), { type: 'spr', stem: '<p>Find x.</p>', correct_answer: ['1/4', ' .25 ', '0.25'], rationale: '<p>r</p>' }, ctx);
    expect(r.ok && r.question.answer).toEqual({ kind: 'spr', accepted: ['1/4', '.25', '0.25'] });
  });

  it('skips when keys points at a different option than correct_answer', () => {
    const r = toQuestion(row(), { ...digitalMcq, keys: ['o3'] }, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'mcq-key-mismatch' });
  });

  it('skips when the rationale names a different choice than the key', () => {
    const r = toQuestion(row(), { ...digitalMcq, rationale: '<p>Choice C is correct.</p>' }, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'mcq-key-conflicts-rationale' });
  });

  it('skips on wrong option count, bad key, empty stem and bad shape', () => {
    expect(toQuestion(row(), { ...digitalMcq, answerOptions: digitalMcq.answerOptions.slice(0, 3) }, ctx)).toMatchObject({ reason: 'mcq-options' });
    expect(toQuestion(row(), { ...digitalMcq, correct_answer: ['E'] }, ctx)).toMatchObject({ reason: 'mcq-key-invalid' });
    expect(toQuestion(row(), { ...digitalMcq, stem: '<p> </p>' }, ctx)).toMatchObject({ reason: 'empty-stem' });
    expect(toQuestion(row(), { type: 'essay' }, ctx)).toMatchObject({ reason: 'detail-shape' });
    expect(toQuestion(row(), null, ctx)).toMatchObject({ reason: 'detail-shape' });
  });

  it('skips spr with no usable answers', () => {
    const r = toQuestion(row(), { type: 'spr', stem: '<p>x</p>', correct_answer: [' '], rationale: '' }, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'spr-no-answer' });
  });
});

describe('toQuestion: legacy', () => {
  it('uses the structured correct_choice', () => {
    const r = toQuestion(legacyRow, legacy({ correct_choice: 'd' }), ctx);
    expect(r.ok && r.question.answer).toMatchObject({ kind: 'mcq', correct: 'D', keyOrigin: 'structured' });
    expect(r.ok && r.keyFromRationale).toBe(false);
  });

  it('extracts the key from the rationale when stated exactly once', () => {
    const r = toQuestion(legacyRow, legacy({}), ctx);
    expect(r.ok && r.question.answer).toMatchObject({ correct: 'D', keyOrigin: 'rationale' });
    expect(r.ok && r.keyFromRationale).toBe(true);
    expect(r.ok && validateQuestion(r.question).ok).toBe(true);
  });

  it('skips when the rationale is ambiguous', () => {
    const r = toQuestion(legacyRow, legacy({ rationale: 'Choice A is correct, or perhaps Choice B is correct.' }), ctx);
    expect(r).toMatchObject({ ok: false, reason: 'legacy-mcq-no-key' });
  });

  it('skips when structured key and rationale disagree', () => {
    const r = toQuestion(legacyRow, legacy({ correct_choice: 'a' }), ctx);
    expect(r).toMatchObject({ ok: false, reason: 'mcq-key-conflicts-rationale' });
  });

  it('always skips legacy spr without a structured key, even if prose states an answer', () => {
    const r = toQuestion(legacyRow, { item_id: 'L-1-DC', prompt: '<p>p</p>', answer: { style: 'SPR', rationale: 'The correct answer is 4.' } }, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'legacy-spr-no-key' });
  });

  it('skips unknown styles and missing choices', () => {
    expect(toQuestion(legacyRow, legacy({ style: 'Grid' }), ctx)).toMatchObject({ reason: 'legacy-unknown-style' });
    expect(toQuestion(legacyRow, legacy({ correct_choice: 'd', choices: { a: { body: '1' } } }), ctx)).toMatchObject({ reason: 'mcq-options' });
  });
});

describe('dedupeRows', () => {
  it('keeps the newest row per id', () => {
    const out = dedupeRows([row({ updateDate: 1, questionId: 'old' }), row({ external_id: 'd-2' }), row({ updateDate: 5, questionId: 'new' })]);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.external_id === 'd-1')?.questionId).toBe('new');
  });
});

describe('canonicalSkillNames', () => {
  it('picks the most common spelling per skill code', () => {
    const names = canonicalSkillNames([
      row({ skill_cd: 'CTC', skill_desc: 'Cross-Text Connections' }),
      row({ skill_cd: 'CTC', skill_desc: 'Cross-Text Connections' }),
      row({ skill_cd: 'CTC', skill_desc: 'Cross-text Connections' }),
    ]);
    expect(names.get('CTC')).toBe('Cross-Text Connections');
  });
});
