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

/** What the answer preview shows: nothing, the text as typed, or a stacked fraction. */
export type SprPreview =
  | { kind: 'empty' }
  | { kind: 'plain'; text: string }
  | { kind: 'fraction'; negative: boolean; numerator: string; denominator: string };

/**
 * The preview of a typed answer. "a/b" (with or without a leading minus, either part possibly still
 * empty while typing) is a stacked fraction; anything else is shown as typed. ASSUMED style: the
 * screenshots show the preview label but never a typed value.
 */
export function sprPreview(value: string): SprPreview {
  if (value === '') return { kind: 'empty' };
  const slash = value.indexOf('/');
  if (slash === -1) return { kind: 'plain', text: value };
  const negative = value.startsWith('-');
  return { kind: 'fraction', negative, numerator: value.slice(negative ? 1 : 0, slash), denominator: value.slice(slash + 1) };
}
