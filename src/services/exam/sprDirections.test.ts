// The official student-produced response examples (seen in a real practice test) as tests: what the
// box lets you type, and how the typed value is graded. See docs/exam-spec.md for the labels.

import { describe, expect, it } from 'vitest';
import { isSprCorrect } from '../answers';
import { isAllowedSprInput, nextSprValue, sprPreview } from './spr';

/** Types `text` one key at a time, as the box would see it. */
function typeKeys(text: string): string {
  let v = '';
  for (const ch of text) v = nextSprValue(v, v + ch);
  return v;
}

const EXAMPLES: { key: string[]; accepted: string[]; rejected: string[] }[] = [
  { key: ['3.5', '7/2'], accepted: ['3.5', '3.50', '7/2'], rejected: ['31/2', '3 1/2'] },
  { key: ['2/3'], accepted: ['2/3', '.6666', '.6667', '0.666', '0.667'], rejected: ['0.66', '.66', '0.67', '.67'] },
  { key: ['-1/3'], accepted: ['-1/3', '-.3333', '-0.333'], rejected: ['-.33', '-0.33'] },
];

describe('official examples table', () => {
  for (const ex of EXAMPLES) {
    for (const a of ex.accepted) {
      it(`accepts ${a} for ${ex.key[0]}, and it can be typed`, () => {
        expect(typeKeys(a)).toBe(a);
        expect(isSprCorrect(a, ex.key)).toBe(true);
      });
    }
    for (const r of ex.rejected) {
      it(`rejects ${r} for ${ex.key[0]}`, () => {
        expect(isSprCorrect(r, ex.key)).toBe(false);
      });
    }
  }

  it('cannot type the space in a mixed number', () => {
    expect(typeKeys('3 1/2')).toBe('31/2');
    expect(isAllowedSprInput('3 1/2')).toBe(false);
  });
});

describe('character limits as typed', () => {
  it('stops a positive answer at 5 characters, counting the point', () => {
    expect(typeKeys('.66666')).toBe('.6666');
    expect(typeKeys('0.6667')).toBe('0.666');
    expect(typeKeys('12345')).toBe('12345');
    expect(typeKeys('123456')).toBe('12345');
  });

  it('allows 6 characters when the first is a minus, counting the minus and the point', () => {
    expect(typeKeys('-.3333')).toBe('-.3333');
    expect(typeKeys('-0.3333')).toBe('-0.333');
    expect(typeKeys('-12345')).toBe('-12345');
    expect(typeKeys('-123456')).toBe('-12345');
  });

  it('counts the slash (unverified)', () => {
    expect(typeKeys('100/3')).toBe('100/3');
    expect(typeKeys('1000/3')).toBe('1000/');
  });

  it('takes a minus only as the first character', () => {
    expect(typeKeys('3-')).toBe('3');
    expect(typeKeys('--3')).toBe('-3');
  });

  it('rejects a decimal and a slash together', () => {
    expect(typeKeys('1.5/2')).toBe('1.52');
    expect(isAllowedSprInput('1/.5')).toBe(false);
    expect(isSprCorrect('1.5/2', ['3/4'])).toBe(false);
  });

  it('rejects percent, comma, dollar and spaces', () => {
    for (const bad of ['5%', '1,000', '$5', ' 5', '5 ']) expect(isAllowedSprInput(bad)).toBe(false);
    expect(typeKeys('$1,0 0%')).toBe('100');
  });

  it('a pasted value over the limit is ignored as a whole', () => {
    expect(nextSprValue('', '0.6667')).toBe('');
    expect(nextSprValue('0.6', '0.6667')).toBe('0.6');
  });

  it('grades empty input as wrong', () => {
    expect(isSprCorrect('', ['2/3'])).toBe(false);
    expect(typeKeys('')).toBe('');
  });
});

describe('decimal tolerance (inferred)', () => {
  it('applies only to values that do not fit in the typed places', () => {
    // 3.5 fits in one place: 3.499 is not a truncation of it.
    expect(isSprCorrect('3.499', ['7/2'])).toBe(false);
    expect(isSprCorrect('3.500', ['7/2'])).toBe(true);
  });

  it('rounds half away from zero and truncates toward zero', () => {
    // 1/8 = .125: four places fit it exactly, so only .125 and .1250 count.
    expect(isSprCorrect('.1250', ['1/8'])).toBe(true);
    // 1/16 = .0625: at three places, truncation .062 and rounding .063 both pass.
    expect(isSprCorrect('.062', ['1/16'])).toBe(true);
    expect(isSprCorrect('.063', ['1/16'])).toBe(true);
    expect(isSprCorrect('.064', ['1/16'])).toBe(false);
    expect(isSprCorrect('-.063', ['-1/16'])).toBe(true);
    expect(isSprCorrect('-.062', ['-1/16'])).toBe(true);
  });

  it('is not used against decimal-only keys', () => {
    expect(isSprCorrect('.001', ['.0014'])).toBe(false);
  });

  it('needs at least three places', () => {
    expect(isSprCorrect('.17', ['3/17'])).toBe(false);
    expect(isSprCorrect('.176', ['3/17'])).toBe(true);
    expect(isSprCorrect('.177', ['3/17'])).toBe(false);
    expect(isSprCorrect('.1765', ['3/17'])).toBe(true);
  });
});

describe('answer preview', () => {
  it('shows nothing, plain text or a stacked fraction', () => {
    expect(sprPreview('')).toEqual({ kind: 'empty' });
    expect(sprPreview('-.5')).toEqual({ kind: 'plain', text: '-.5' });
    expect(sprPreview('-1/3')).toEqual({ kind: 'fraction', negative: true, numerator: '1', denominator: '3' });
    expect(sprPreview('7/')).toEqual({ kind: 'fraction', negative: false, numerator: '7', denominator: '' });
  });
});
