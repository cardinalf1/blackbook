import { describe, expect, it } from 'vitest';
import { isAllowedSprInput, nextSprValue } from './spr';

describe('student-produced response input', () => {
  it('allows digits, a decimal point, a fraction bar and a leading minus', () => {
    for (const v of ['', '7', '3.5', '.25', '7/2', '-', '-1.25', '12345', '-9999', '0.667']) expect(isAllowedSprInput(v), v).toBe(true);
  });
  it('limits length to 5, or 6 with a leading minus', () => {
    expect(isAllowedSprInput('123456')).toBe(false);
    expect(isAllowedSprInput('-12345')).toBe(true);
    expect(isAllowedSprInput('-123456')).toBe(false);
  });
  it('rejects other characters and a minus anywhere but first', () => {
    for (const v of ['1,000', '50%', '$5', 'abc', '3 1/2', '1-2', '2e3', '+4']) expect(isAllowedSprInput(v), v).toBe(false);
  });
  it('takes one answer only: one decimal point or one fraction bar, never both', () => {
    for (const v of ['1.2.3', '1/2/3', '1.5/2', '/2', '-/2', '..', '1//2']) expect(isAllowedSprInput(v), v).toBe(false);
    for (const v of ['1/2', '-1/2', '.5', '3.', '-.5']) expect(isAllowedSprInput(v), v).toBe(true);
  });
  it('rejects the forms the directions forbid: mixed numbers, percent, comma, dollar', () => {
    for (const v of ['2 1/2', '2+1/2', '25%', '1,5', '$5']) expect(isAllowedSprInput(v), v).toBe(false);
  });
  it('keeps the previous value when an edit is not allowed', () => {
    expect(nextSprValue('12', '12a')).toBe('12');
    expect(nextSprValue('12345', '123456')).toBe('12345');
    expect(nextSprValue('12', '123')).toBe('123');
  });
});
