import { describe, expect, it } from 'vitest';
import { validateBank, validateQuestion } from '../bank/validate';
import {
  rawDigitalMcq,
  rawDigitalSpr,
  rawLegacyMcq,
  rawLegacyMcqAmbiguous,
  rawLegacyMcqKeyInRationale,
  rawLegacySprNoKey,
  rawListRows,
  syntheticBank,
  syntheticQuestions,
} from './synthetic';

describe('syntheticQuestions', () => {
  it('contains exactly 24 items with unique ids syn-0001 through syn-0024', () => {
    expect(syntheticQuestions).toHaveLength(24);
    const ids = syntheticQuestions.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(24);

    for (let i = 1; i <= 24; i++) {
      const expectedId = `syn-${String(i).padStart(4, '0')}`;
      expect(ids[i - 1]).toBe(expectedId);
    }
  });

  it('passes validateQuestion for every question item', () => {
    syntheticQuestions.forEach((q) => {
      const res = validateQuestion(q);
      expect(res.ok).toBe(true);
      if (!res.ok) {
        // Helpful diagnostic if any fails
        expect(res.errors).toEqual([]);
      }
    });
  });

  it('satisfies section balance: 12 rw and 12 math', () => {
    const rwItems = syntheticQuestions.filter((q) => q.section === 'rw');
    const mathItems = syntheticQuestions.filter((q) => q.section === 'math');
    expect(rwItems).toHaveLength(12);
    expect(mathItems).toHaveLength(12);
  });

  it('satisfies difficulty coverage E, M, H in each section', () => {
    const rwItems = syntheticQuestions.filter((q) => q.section === 'rw');
    const mathItems = syntheticQuestions.filter((q) => q.section === 'math');

    const rwDiffs = new Set(rwItems.map((q) => q.difficulty));
    expect(rwDiffs.has('E')).toBe(true);
    expect(rwDiffs.has('M')).toBe(true);
    expect(rwDiffs.has('H')).toBe(true);

    const mathDiffs = new Set(mathItems.map((q) => q.difficulty));
    expect(mathDiffs.has('E')).toBe(true);
    expect(mathDiffs.has('M')).toBe(true);
    expect(mathDiffs.has('H')).toBe(true);
  });

  it('includes at least 4 SPR questions in Math and none in RW', () => {
    const rwSpr = syntheticQuestions.filter((q) => q.section === 'rw' && q.answer.kind === 'spr');
    expect(rwSpr).toHaveLength(0);

    const mathSpr = syntheticQuestions.filter((q) => q.section === 'math' && q.answer.kind === 'spr');
    expect(mathSpr.length).toBeGreaterThanOrEqual(4);

    // One with several accepted answers (e.g. ['1/4', '.25', '0.25'])
    const multiAccepted = mathSpr.some((q) => q.answer.kind === 'spr' && q.answer.accepted.length >= 3);
    expect(multiAccepted).toBe(true);

    // One with a negative accepted answer (e.g. ['-3'])
    const negativeAccepted = mathSpr.some(
      (q) => q.answer.kind === 'spr' && q.answer.accepted.some((ans) => ans.startsWith('-')),
    );
    expect(negativeAccepted).toBe(true);
  });

  it('includes at least 3 questions with non-null stimulusHtml', () => {
    const withStimulus = syntheticQuestions.filter((q) => q.stimulusHtml !== null);
    expect(withStimulus.length).toBeGreaterThanOrEqual(3);
  });

  it('includes at least 2 questions with source legacy and keyOrigin rationale', () => {
    const legacyRationale = syntheticQuestions.filter(
      (q) => q.source === 'legacy' && q.answer.kind === 'mcq' && q.answer.keyOrigin === 'rationale',
    );
    expect(legacyRationale.length).toBeGreaterThanOrEqual(2);
  });

  it('uses valid domain and skill codes from docs/api-notes.md', () => {
    const validRwDomains = new Set(['INI', 'CAS', 'EOI', 'SEC']);
    const validMathDomains = new Set(['H', 'P', 'Q', 'S']);

    syntheticQuestions.forEach((q) => {
      if (q.section === 'rw') {
        expect(validRwDomains.has(q.domainCode)).toBe(true);
      } else {
        expect(validMathDomains.has(q.domainCode)).toBe(true);
      }
      expect(q.skillCode.length).toBeGreaterThan(0);
      expect(q.skill.length).toBeGreaterThan(0);
    });
  });

  it('uses bb-math spans with data-latex for math formulas', () => {
    const mathItems = syntheticQuestions.filter((q) => q.section === 'math');
    const usesBbMath = mathItems.every((q) => {
      const fullHtml = `${q.stimulusHtml ?? ''} ${q.stemHtml} ${q.rationaleHtml}`;
      return fullHtml.includes('class="bb-math"') && fullHtml.includes('data-latex=');
    });
    expect(usesBbMath).toBe(true);
  });

  it('includes one item with an inline svg graph with viewBox 0 0 100 100', () => {
    const svgItems = syntheticQuestions.filter((q) => {
      const fullHtml = `${q.stimulusHtml ?? ''} ${q.stemHtml}`;
      return fullHtml.includes('<svg') && fullHtml.includes('viewBox="0 0 100 100"');
    });
    expect(svgItems).toHaveLength(1);
  });

  it('includes one rw stem using underlined text', () => {
    const rwUnderlined = syntheticQuestions.filter(
      (q) => q.section === 'rw' && /<u>.+<\/u>/.test(q.stemHtml),
    );
    expect(rwUnderlined).toHaveLength(1);
  });
});

describe('syntheticBank', () => {
  it('validates syntheticBank with validateBank and finds 0 invalid items', () => {
    const res = validateBank(syntheticBank);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.invalid).toHaveLength(0);
      expect(res.value.questions).toHaveLength(24);
      expect(res.value.skipped).toHaveLength(1);
      expect(res.value.fetchedAt).toBe('2026-10-14T20:00:00.000Z');
    }
  });
});

describe('raw shapes', () => {
  it('rawListRows has 6 rows with duplicate id and legacy row', () => {
    expect(Array.isArray(rawListRows)).toBe(true);
    const rows = rawListRows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(6);

    // One legacy row with ibn and external_id null
    const legacyRow = rows.find((r) => r.external_id === null && typeof r.ibn === 'string' && r.ibn.length > 0);
    expect(legacyRow).toBeDefined();

    // Duplicate external_id with older updateDate
    const externalIds = rows.map((r) => r.external_id).filter((id): id is string => typeof id === 'string');
    const counts = new Map<string, number>();
    externalIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    const duplicateId = [...counts.entries()].find(([, count]) => count > 1)?.[0];
    expect(duplicateId).toBeDefined();

    const matchingRows = rows.filter((r) => r.external_id === duplicateId);
    expect(matchingRows).toHaveLength(2);
    const [rowA, rowB] = matchingRows;
    expect(typeof rowA?.updateDate).toBe('number');
    expect(typeof rowB?.updateDate).toBe('number');
    expect(rowA?.updateDate).not.toBe(rowB?.updateDate);
  });

  it('rawDigitalMcq has MathML with mfenced and valid mcq structure', () => {
    const mcq = rawDigitalMcq as Record<string, unknown>;
    expect(mcq.type).toBe('mcq');
    expect(typeof mcq.stem).toBe('string');
    expect((mcq.stem as string).includes('<math')).toBe(true);
    expect((mcq.stem as string).includes('<mfenced')).toBe(true);
    expect(Array.isArray(mcq.answerOptions)).toBe(true);
    expect(mcq.answerOptions).toHaveLength(4);
    expect(mcq.correct_answer).toEqual(['B']);
  });

  it('rawDigitalSpr has MathML with mfrac and 2 accepted values', () => {
    const spr = rawDigitalSpr as Record<string, unknown>;
    expect(spr.type).toBe('spr');
    expect(typeof spr.stem).toBe('string');
    expect((spr.stem as string).includes('<math')).toBe(true);
    expect((spr.stem as string).includes('<mfrac')).toBe(true);
    expect(Array.isArray(spr.correct_answer)).toBe(true);
    expect(spr.correct_answer).toHaveLength(2);
  });

  it('rawLegacyMcq has correct_choice and math placeholder img', () => {
    const legacy = rawLegacyMcq as {
      prompt: string;
      answer: { correct_choice?: string; style: string };
    };
    expect(legacy.answer.style).toBe('Multiple Choice');
    expect(legacy.answer.correct_choice).toBe('b');
    expect(legacy.prompt).toContain('<img class="math-img" role="math"');
    expect(legacy.prompt).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  it('rawLegacyMcqKeyInRationale has no correct_choice and rationale with exact phrase once', () => {
    const legacy = rawLegacyMcqKeyInRationale as {
      prompt: string;
      answer: { correct_choice?: string; rationale: string };
    };
    expect(legacy.answer.correct_choice).toBeUndefined();
    expect(legacy.prompt).toContain('<img class="math-img" role="math"');
    const matches = legacy.answer.rationale.match(/Choice C is correct\./g);
    expect(matches).toHaveLength(1);
  });

  it('rawLegacyMcqAmbiguous has no correct_choice and rationale with both A and B correct', () => {
    const legacy = rawLegacyMcqAmbiguous as {
      prompt: string;
      answer: { correct_choice?: string; rationale: string };
    };
    expect(legacy.answer.correct_choice).toBeUndefined();
    expect(legacy.prompt).toContain('<img class="math-img" role="math"');
    expect(legacy.answer.rationale).toContain('Choice A is correct');
    expect(legacy.answer.rationale).toContain('Choice B is correct');
  });

  it('rawLegacySprNoKey has style SPR and no answer key', () => {
    const legacy = rawLegacySprNoKey as {
      prompt: string;
      answer: Record<string, unknown>;
    };
    expect(legacy.answer.style).toBe('SPR');
    expect(legacy.answer.correct_choice).toBeUndefined();
    expect(legacy.answer.correct_answer).toBeUndefined();
    expect(legacy.answer.keys).toBeUndefined();
    expect(legacy.prompt).toContain('<img class="math-img" role="math"');
  });
});
