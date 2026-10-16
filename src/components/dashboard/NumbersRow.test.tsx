import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NumbersRow as NumbersRowData } from '../../types/dashboard';
import { NumbersRow } from './NumbersRow';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NumbersRow', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  const baseNumbers: NumbersRowData = {
    estimate: {
      testId: 'test-1',
      finishedAt: new Date(2026, 9, 15).getTime(),
      low: 1350,
      high: 1450,
      configVersion: 2,
    },
    firstAttempt: {
      correct: 40,
      attempts: 50,
      previous: null,
    },
    questionsDone: {
      done: 120,
      seen: 180,
      total: 1000,
      live: 950,
    },
    freshTests: {
      full: 8,
      rw: 10,
      math: 9,
      capped: false,
    },
    studyWeek: {
      activeMs: 5400000, // 90 min
      previousMs: 3600000, // 60 min
      sessions: 4,
    },
    pace: [
      {
        section: 'rw',
        attempts: 25,
        timeMs: 1875000, // 75s per answer = 1:15
        targetMs: 71000, // 71s = 1:11
        previous: {
          attempts: 20,
          timeMs: 1600000, // 80s per answer
        },
      },
      {
        section: 'math',
        attempts: 25,
        timeMs: 2375000, // 95s = 1:35
        targetMs: 95000, // 95s = 1:35
        previous: null,
      },
    ],
  };

  async function renderRow(numbers: NumbersRowData) {
    if (!root) {
      root = createRoot(container);
    }
    await act(async () => {
      root?.render(<NumbersRow numbers={numbers} />);
    });
  }

  it('renders estimate tile with range, approximation tag, tooltip title, and date', async () => {
    await renderRow(baseNumbers);

    expect(container.textContent).toContain('1350–1450');
    expect(container.textContent).toContain('approximation');
    const rangeSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent?.includes('1350–1450'),
    );
    expect(rangeSpan?.getAttribute('title')).toBe('Scoring config version 2');
    expect(container.textContent).toContain('Oct 15, 2026');
  });

  it('renders "No full test yet" when estimate is null', async () => {
    await renderRow({
      ...baseNumbers,
      estimate: null,
    });

    expect(container.textContent).toContain('No full test yet');
    expect(container.textContent).not.toContain('approximation');
  });

  it('renders "not enough data" for accuracy change when previous is null', async () => {
    await renderRow(baseNumbers);

    expect(container.textContent).toContain('80%');
    expect(container.textContent).toContain('40 of 50 (80%)');
    expect(container.textContent).toContain('N = 50');
    expect(container.textContent).toContain('not enough data');
  });

  it('renders percentage points change when previous is non-null', async () => {
    await renderRow({
      ...baseNumbers,
      firstAttempt: {
        correct: 40,
        attempts: 50, // 80%
        previous: {
          correct: 35,
          attempts: 50, // 70%
        },
      },
    });

    expect(container.textContent).toContain('+10 pp vs previous');
    expect(container.textContent).not.toContain('not enough data');
  });

  it('renders questions done with done of total, seen, and fresh tests estimate', async () => {
    await renderRow(baseNumbers);

    expect(container.textContent).toContain('120 of 1000');
    expect(container.textContent).toContain('180 seen');
    expect(container.textContent).toContain('about 8 full tests left (estimate)');
  });

  it('renders "about 50 or more full tests left (estimate)" when capped and "unknown" when null', async () => {
    await renderRow({
      ...baseNumbers,
      freshTests: { full: 50, rw: 50, math: 50, capped: true },
    });
    expect(container.textContent).toContain('about 50 or more full tests left (estimate)');

    await renderRow({
      ...baseNumbers,
      freshTests: null,
    });
    expect(container.textContent).toContain('unknown');
  });

  it('renders study time in minutes, sessions count, and change vs previousMs', async () => {
    await renderRow(baseNumbers);

    expect(container.textContent).toContain('90 min');
    expect(container.textContent).toContain('4 sessions');
    expect(container.textContent).toContain('+30 min vs previous');
  });

  it('renders pace per section with N, formatted m:ss vs target, and change only when previous non-null', async () => {
    await renderRow(baseNumbers);

    // RW has previous: 75s (1:15) vs target 71s (1:11), diff vs prev 80s = -5s
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('1:15 per answer vs target 1:11');
    expect(container.textContent).toContain('-5s vs previous');

    // Math has no previous: 95s (1:35) vs target 95s (1:35)
    expect(container.textContent).toContain('Math');
    expect(container.textContent).toContain('1:35 per answer vs target 1:35');
  });
});
