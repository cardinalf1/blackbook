// Answer checking. SPR answers match when the normalized text equals an accepted answer, or when
// both parse as the same exact number (e.g. "4" and "4.0", "-1/2" and "-0.5").

import type { Answer, ChoiceLetter } from '../types/sat';

export function normalizeSpr(input: string): string {
  // Only trim the ends: collapsing inner spaces would turn "2 1/2" into "21/2".
  return input.trim().replace(/−/g, '-').replace(/^\+/, '');
}

/** Parses an integer, decimal or simple fraction. Returns null for anything else. */
export function parseSprNumber(input: string): number | null {
  const s = normalizeSpr(input);
  const frac = /^(-?\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

export function isSprCorrect(input: string, accepted: readonly string[]): boolean {
  const s = normalizeSpr(input);
  if (s === '') return false;
  if (accepted.some((a) => normalizeSpr(a) === s)) return true;
  const n = parseSprNumber(s);
  if (n === null) return false;
  return accepted.some((a) => {
    const m = parseSprNumber(a);
    return m !== null && Math.abs(m - n) < 1e-9;
  });
}

export function isCorrect(answer: Answer, response: ChoiceLetter | string): boolean {
  return answer.kind === 'mcq' ? response === answer.correct : isSprCorrect(response, answer.accepted);
}
