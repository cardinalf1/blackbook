// Answer checking. See docs/spr-grading.md for the forms found in the real bank and the rules.
//
// A student-produced response is correct when it exactly equals a listed form after trimming, or
// when it parses to exactly the same number as a listed form. Numbers are compared as exact
// fractions, never as floats, so a rounded decimal is not accepted unless the bank lists it.

import type { Answer, ChoiceLetter } from '../types/sat';

interface Rational {
  num: bigint;
  den: bigint; // always > 0
}

export function normalizeSpr(input: string): string {
  // Only trim the ends: collapsing inner spaces would turn "2 1/2" into "21/2".
  return input.trim().replace(/−/g, '-').replace(/^\+/, '');
}

const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?(\d+\.\d+|\.\d+)$/; // a trailing dot ("5.") is not accepted
const FRACTION = /^(-?\d+)\/(\d+)$/;
const MAX_DIGITS = 18; // far beyond any real answer; keeps BigInt work trivial

/** Parses an integer, decimal or simple fraction exactly. Returns null for anything else. */
export function parseSprRational(input: string): Rational | null {
  const s = normalizeSpr(input);
  if (s.length > 2 * MAX_DIGITS + 2) return null;
  if (INTEGER.test(s)) return { num: BigInt(s), den: 1n };
  if (DECIMAL.test(s)) {
    const neg = s.startsWith('-');
    const [whole = '', frac = ''] = s.replace('-', '').split('.');
    const num = BigInt(`${whole || '0'}${frac}`);
    return { num: neg ? -num : num, den: 10n ** BigInt(frac.length) };
  }
  const m = FRACTION.exec(s);
  if (m) {
    const den = BigInt(m[2] as string);
    return den === 0n ? null : { num: BigInt(m[1] as string), den };
  }
  return null;
}

/** Numeric value as a float, for display or loose use only. Grading uses parseSprRational. */
export function parseSprNumber(input: string): number | null {
  const r = parseSprRational(input);
  return r === null ? null : Number(r.num) / Number(r.den);
}

function sameValue(a: Rational, b: Rational): boolean {
  return a.num * b.den === b.num * a.den;
}

export function isSprCorrect(input: string, accepted: readonly string[]): boolean {
  const s = normalizeSpr(input);
  if (s === '') return false;
  if (accepted.some((a) => normalizeSpr(a) === s)) return true;
  const n = parseSprRational(s);
  if (n === null) return false;
  return accepted.some((a) => {
    const m = parseSprRational(a);
    return m !== null && sameValue(m, n);
  });
}

export function isCorrect(answer: Answer, response: ChoiceLetter | string): boolean {
  return answer.kind === 'mcq' ? response === answer.correct : isSprCorrect(response, answer.accepted);
}
