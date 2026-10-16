// Answer checking. See docs/spr-grading.md for the forms found in the real bank and the rules.
//
// A student-produced response is correct when it exactly equals a listed form after trimming, or
// when it parses to exactly the same number as a listed form. Numbers are compared as exact
// fractions, never as floats. A decimal of 3 or more places that truncates or rounds a fraction in
// the key correctly is also accepted (inferred from the official examples; SPR_DECIMAL_MIN_PLACES).

import { SPR_DECIMAL_MIN_PLACES } from '../config/scoringConfig';
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

/** `v` cut to `places` decimals toward zero, and rounded half away from zero, as exact rationals. */
function truncAndRound(v: Rational, places: number): [Rational, Rational] {
  const scale = 10n ** BigInt(places);
  const neg = v.num < 0n;
  const abs = neg ? -v.num : v.num;
  const scaled = abs * scale; // value * 10^places * den
  const t = scaled / v.den; // BigInt division truncates
  const r = (2n * scaled + v.den) / (2n * v.den); // floor(x + 1/2) for x >= 0
  const sign = neg ? -1n : 1n;
  return [
    { num: sign * t, den: scale },
    { num: sign * r, den: scale },
  ];
}

/**
 * The inferred decimal rule (SPR_DECIMAL_MIN_PLACES in scoringConfig): a decimal with at least that
 * many places is accepted for a fraction in the key whose value needs more places than it has,
 * when it is that value truncated or rounded at its last place.
 */
function isAcceptedDecimalApproximation(s: string, n: Rational, accepted: readonly string[]): boolean {
  if (!DECIMAL.test(s)) return false;
  const places = s.length - s.indexOf('.') - 1;
  if (places < SPR_DECIMAL_MIN_PLACES) return false;
  return accepted.some((a) => {
    if (!FRACTION.test(normalizeSpr(a))) return false;
    const v = parseSprRational(a);
    if (v === null) return false;
    const [t, r] = truncAndRound(v, places);
    // Only when the exact value does not fit in that many places; otherwise equality decides.
    if (sameValue(t, v)) return false;
    return sameValue(t, n) || sameValue(r, n);
  });
}

export function isSprCorrect(input: string, accepted: readonly string[]): boolean {
  const s = normalizeSpr(input);
  if (s === '') return false;
  if (accepted.some((a) => normalizeSpr(a) === s)) return true;
  const n = parseSprRational(s);
  if (n === null) return false;
  if (
    accepted.some((a) => {
      const m = parseSprRational(a);
      return m !== null && sameValue(m, n);
    })
  ) {
    return true;
  }
  return isAcceptedDecimalApproximation(s, n, accepted);
}

export function isCorrect(answer: Answer, response: ChoiceLetter | string): boolean {
  return answer.kind === 'mcq' ? response === answer.correct : isSprCorrect(response, answer.accepted);
}
