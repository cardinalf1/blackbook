// Input rules for a student-produced response box in an exam module (see docs/exam-spec.md).

import { SPR_ALLOWED, SPR_MAX_CHARS, SPR_MAX_CHARS_NEGATIVE } from '../../config/examConfig';

/**
 * Whether the box may hold `value`: only digits, '.', '/' and a leading '-', at most 5 characters,
 * or 6 when it starts with '-'; one answer only, so at most one '.', at most one '/', and not both
 * (a decimal fraction is not a form the directions list). Partial entries ("-", "3/", ".") are
 * allowed while typing. UNVERIFIED: whether '.' and '/' count toward the length limit; they do here.
 */
export function isAllowedSprInput(value: string): boolean {
  if (!SPR_ALLOWED.test(value)) return false;
  const dots = value.split('.').length - 1;
  const bars = value.split('/').length - 1;
  if (dots > 1 || bars > 1 || (dots === 1 && bars === 1)) return false;
  if (value.replace(/^-/, '').startsWith('/')) return false;
  const max = value.startsWith('-') ? SPR_MAX_CHARS_NEGATIVE : SPR_MAX_CHARS;
  return value.length <= max;
}

/** The new box value after an edit: the edit if it is allowed, otherwise the previous value. */
export function nextSprValue(previous: string, attempted: string): string {
  return isAllowedSprInput(attempted) ? attempted : previous;
}
