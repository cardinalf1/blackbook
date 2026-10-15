import { describe, expect, it } from 'vitest';
import { formatCountdown } from './formatCountdown';

describe('formatCountdown', () => {
  it('formats under an hour correctly without leading zero on minutes', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(7000)).toBe('0:07');
    expect(formatCountdown(299000)).toBe('4:59');
    expect(formatCountdown(1919000)).toBe('31:59');
  });

  it('ceils to whole seconds', () => {
    expect(formatCountdown(999)).toBe('0:01');
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(1000)).toBe('0:01');
    expect(formatCountdown(1001)).toBe('0:02');
    expect(formatCountdown(60000)).toBe('1:00');
    expect(formatCountdown(1919001)).toBe('32:00');
  });

  it('formats at or above an hour as H:MM:SS with padded minutes and seconds', () => {
    expect(formatCountdown(3600000)).toBe('1:00:00');
    expect(formatCountdown(3599001)).toBe('1:00:00'); // ceils to 3600s
    expect(formatCountdown(3661000)).toBe('1:01:01');
    expect(formatCountdown(7325000)).toBe('2:02:05');
  });

  it('handles zero, negative numbers, and non-finite numbers', () => {
    expect(formatCountdown(-1)).toBe('0:00');
    expect(formatCountdown(-5000)).toBe('0:00');
    expect(formatCountdown(Number.NEGATIVE_INFINITY)).toBe('0:00');
    expect(formatCountdown(NaN)).toBe('0:00');
  });
});
