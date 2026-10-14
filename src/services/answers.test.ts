import { describe, expect, it } from 'vitest';
import { isCorrect, isSprCorrect, parseSprNumber } from './answers';

describe('isSprCorrect', () => {
  it('matches accepted forms after trimming and sign cleanup', () => {
    expect(isSprCorrect(' 1/4 ', ['1/4', '.25'])).toBe(true);
    expect(isSprCorrect('−3', ['-3'])).toBe(true);
    expect(isSprCorrect('+7', ['7'])).toBe(true);
  });

  it('matches equal exact numbers in other forms', () => {
    expect(isSprCorrect('4.0', ['4'])).toBe(true);
    expect(isSprCorrect('-0.5', ['-1/2'])).toBe(true);
    expect(isSprCorrect('0.25', ['1/4'])).toBe(true);
  });

  it('rejects wrong, empty and non-numeric answers', () => {
    expect(isSprCorrect('0.3', ['1/3', '.3333', '0.3333'])).toBe(false);
    expect(isSprCorrect('', ['0'])).toBe(false);
    expect(isSprCorrect('abc', ['4'])).toBe(false);
    expect(isSprCorrect('1/0', ['1'])).toBe(false);
  });
});

describe('parseSprNumber', () => {
  it('parses integers, decimals and fractions only', () => {
    expect(parseSprNumber('12')).toBe(12);
    expect(parseSprNumber('.5')).toBe(0.5);
    expect(parseSprNumber('-3/4')).toBe(-0.75);
    expect(parseSprNumber('1e3')).toBeNull();
    expect(parseSprNumber('2 1/2')).toBeNull();
  });
});

describe('isCorrect', () => {
  it('checks mcq letters and spr text', () => {
    const mcq = { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct: 'C', keyOrigin: 'structured' } as const;
    expect(isCorrect({ ...mcq, choices: [...mcq.choices] }, 'C')).toBe(true);
    expect(isCorrect({ ...mcq, choices: [...mcq.choices] }, 'A')).toBe(false);
    expect(isCorrect({ kind: 'spr', accepted: ['9'] }, '9')).toBe(true);
  });
});
