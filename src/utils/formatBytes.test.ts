import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('formats 0 B as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats 512 B as "512 B"', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats 1024 B as "1 KB"', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats 1536 B as "1.5 KB"', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats 43.2 MB correctly', () => {
    // 43.2 * 1024 * 1024 = 45298483.2
    expect(formatBytes(43.2 * 1024 * 1024)).toBe('43.2 MB');
  });

  it('handles negative or invalid values safely', () => {
    expect(formatBytes(-100)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B');
    expect(formatBytes(Number.NEGATIVE_INFINITY)).toBe('0 B');
  });

  it('formats GB correctly', () => {
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});
