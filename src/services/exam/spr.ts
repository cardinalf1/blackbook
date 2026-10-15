// Input rules for a student-produced response box in an exam module (see docs/exam-spec.md).

import { SPR_ALLOWED, SPR_MAX_CHARS, SPR_MAX_CHARS_NEGATIVE } from '../../config/examConfig';

/**
 * Whether the box may hold `value`: only digits, '.', '/' and a leading '-', at most 5 characters,
 * or 6 when it starts with '-'. Partial entries ("-", "3/", ".") are allowed while typing.
 */
export function isAllowedSprInput(value: string): boolean {
  if (!SPR_ALLOWED.test(value)) return false;
  const max = value.startsWith('-') ? SPR_MAX_CHARS_NEGATIVE : SPR_MAX_CHARS;
  return value.length <= max;
}

/** The new box value after an edit: the edit if it is allowed, otherwise the previous value. */
export function nextSprValue(previous: string, attempted: string): string {
  return isAllowedSprInput(attempted) ? attempted : previous;
}
