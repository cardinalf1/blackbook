import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats 0 ms as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats 65000 ms as 1:05', () => {
    expect(formatDuration(65000)).toBe('1:05');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(499)).toBe('0:00');
    expect(formatDuration(500)).toBe('0:01');
    expect(formatDuration(59400)).toBe('0:59');
    expect(formatDuration(59500)).toBe('1:00');
    expect(formatDuration(60499)).toBe('1:00');
    expect(formatDuration(60500)).toBe('1:01');
  });

  it('is never negative', () => {
    expect(formatDuration(-1)).toBe('0:00');
    expect(formatDuration(-65000)).toBe('0:00');
  });

  it('handles non-finite values safely', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatDuration(Number.NEGATIVE_INFINITY)).toBe('0:00');
  });

  it('formats large durations as m:ss', () => {
    // 75 minutes and 12 seconds
    expect(formatDuration((75 * 60 + 12) * 1000)).toBe('75:12');
  });
});
