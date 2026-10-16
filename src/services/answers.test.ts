import { describe, expect, it } from 'vitest';
import { isCorrect, isSprCorrect, parseSprNumber, parseSprRational } from './answers';

// The real bank only contains integers, decimals (often with a leading dot) and a/b fractions,
// with 1 to 3 accepted strings per question. These cases use synthetic numbers of those shapes.

describe('isSprCorrect: forms found in the bank', () => {
  it('integers', () => {
    expect(isSprCorrect('403', ['403'])).toBe(true);
    expect(isSprCorrect('404', ['403'])).toBe(false);
    expect(isSprCorrect('0', ['0'])).toBe(true);
  });

  it('negative integers, including the unicode minus', () => {
    expect(isSprCorrect('-3', ['-3'])).toBe(true);
    expect(isSprCorrect('−3', ['-3'])).toBe(true);
    expect(isSprCorrect('3', ['-3'])).toBe(false);
  });

  it('decimals with and without a leading zero', () => {
    expect(isSprCorrect('0.25', ['.25'])).toBe(true);
    expect(isSprCorrect('.25', ['0.25'])).toBe(true);
    expect(isSprCorrect('16.25', ['16.25'])).toBe(true);
    expect(isSprCorrect('-.5', ['-0.5'])).toBe(true);
  });

  it('fractions, and their decimal twins when the bank lists both', () => {
    expect(isSprCorrect('1/4', ['1/4', '.25'])).toBe(true);
    expect(isSprCorrect('.25', ['1/4', '.25'])).toBe(true);
    expect(isSprCorrect('-14/15', ['-.9333', '-14/15'])).toBe(true);
  });

  it('multiple accepted answers with different values (listed roundings)', () => {
    const accepted = ['.1764', '.1765', '3/17'];
    expect(isSprCorrect('.1764', accepted)).toBe(true);
    expect(isSprCorrect('.1765', accepted)).toBe(true);
    expect(isSprCorrect('3/17', accepted)).toBe(true);
    expect(isSprCorrect('.1766', accepted)).toBe(false);
    // Inferred decimal rule: three places, truncating 3/17 = .17647...
    expect(isSprCorrect('.176', accepted)).toBe(true);
    expect(isSprCorrect('.177', accepted)).toBe(false);
  });
});

describe('isSprCorrect: equivalence rules', () => {
  it('accepts exactly equal values in a different form', () => {
    expect(isSprCorrect('0.5', ['1/2'])).toBe(true);
    expect(isSprCorrect('1/2', ['.5'])).toBe(true);
    expect(isSprCorrect('2/4', ['1/2'])).toBe(true);
    expect(isSprCorrect('4.0', ['4'])).toBe(true);
    expect(isSprCorrect('0.50', ['.5'])).toBe(true);
    expect(isSprCorrect('-0.5', ['-1/2'])).toBe(true);
    expect(isSprCorrect('+7', ['7'])).toBe(true);
  });

  it('rejects a rounded or truncated decimal with fewer than three places', () => {
    expect(isSprCorrect('0.33', ['1/3', '.3333'])).toBe(false);
    expect(isSprCorrect('0.3', ['1/3', '.3333', '0.3333'])).toBe(false);
    // Three or more places that truncate or round the fraction are accepted (official examples).
    expect(isSprCorrect('.6667', ['2/3'])).toBe(true);
    expect(isSprCorrect('.6668', ['2/3'])).toBe(false);
  });

  it('compares exactly, not with a float tolerance', () => {
    expect(isSprCorrect('0.1000000000001', ['1/10'])).toBe(false);
    expect(isSprCorrect('0.3333333334', ['1/3'])).toBe(false);
  });

  it('ignores surrounding whitespace only', () => {
    expect(isSprCorrect('  7  ', ['7'])).toBe(true);
    expect(isSprCorrect('1 / 2', ['1/2'])).toBe(false);
    expect(isSprCorrect('2 1/2', ['5/2'])).toBe(false);
  });
});

describe('isSprCorrect: malformed input', () => {
  const accepted = ['4', '1/2', '.5'];
  it.each([
    '',
    '   ',
    'abc',
    '4a',
    '--4',
    '4-',
    '1/0',
    '1/',
    '/2',
    '1/-2',
    '1//2',
    '1/2/3',
    '.',
    '-',
    '5.',
    '1,000',
    '50%',
    '1e3',
    '0x10',
    '٣',
    '4 4',
    '１２',
  ])('rejects %j', (input) => {
    expect(isSprCorrect(input, accepted)).toBe(false);
  });

  it('rejects absurdly long input without throwing', () => {
    expect(isSprCorrect('9'.repeat(5000), ['9'])).toBe(false);
    expect(isSprCorrect(`0.${'0'.repeat(5000)}1`, ['0'])).toBe(false);
  });

  it('a malformed accepted entry never matches a number', () => {
    expect(isSprCorrect('4', ['four'])).toBe(false);
    expect(isSprCorrect('4', ['1/0'])).toBe(false);
  });
});

describe('parseSprRational / parseSprNumber', () => {
  it('parses integers, decimals and fractions only', () => {
    expect(parseSprNumber('12')).toBe(12);
    expect(parseSprNumber('.5')).toBe(0.5);
    expect(parseSprNumber('-3/4')).toBe(-0.75);
    expect(parseSprNumber('1e3')).toBeNull();
    expect(parseSprNumber('2 1/2')).toBeNull();
    expect(parseSprNumber('5.')).toBeNull();
  });

  it('keeps decimals exact', () => {
    expect(parseSprRational('0.1')).toEqual({ num: 1n, den: 10n });
    expect(parseSprRational('-.25')).toEqual({ num: -25n, den: 100n });
    expect(parseSprRational('1/0')).toBeNull();
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
