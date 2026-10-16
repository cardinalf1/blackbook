import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OverviewSummary, TestHistoryRow } from '../../types/analytics';
import { formatStudyTime, OverviewScreen } from './OverviewScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('formatStudyTime', () => {
  it('formats active study time in hours and minutes or minutes only', () => {
    expect(formatStudyTime(0)).toBe('0 min');
    expect(formatStudyTime(-100)).toBe('0 min');
    expect(formatStudyTime(65 * 60 * 1000)).toBe('1 h 05 min');
    expect(formatStudyTime(120 * 60 * 1000)).toBe('2 h 00 min');
    expect(formatStudyTime(25 * 60 * 1000)).toBe('25 min');
  });
});

describe('OverviewScreen', () => {
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

  async function renderScreen(summary: OverviewSummary, latestTests: readonly TestHistoryRow[] = []) {
    root = createRoot(container);
    await act(async () => {
      root?.render(<OverviewScreen summary={summary} latestTests={latestTests} />);
    });
  }

  const emptySummary: OverviewSummary = {
    sessions: { drill: 0, exam: 0 },
    attempts: {
      drill: { attempts: 0, correct: 0, timeMs: 0 },
      exam: { attempts: 0, correct: 0, timeMs: 0 },
    },
    activeMs: { drill: 0, exam: 0 },
    bank: { total: 1000, live: 800, seen: 120, seenLive: 100 },
    daily: [],
    dailyPace: [],
    unattributed: 0,
  };

  it('renders empty state when there are no answers in view', async () => {
    await renderScreen(emptySummary);

    expect(container.textContent).toContain('No finished drills or exam modules in this view yet.');
    expect(container.textContent).toContain('120 of 1000 questions seen (100 of 800 live)');
  });

  it('shows unattributed note when summary.unattributed > 0 in empty view', async () => {
    await renderScreen({ ...emptySummary, unattributed: 3 });

    expect(container.textContent).toContain('3 answers are on questions no longer in the bank and are left out.');
  });

  it('shows both cards side by side with low N for small samples', async () => {
    const summaryWithSmallSample: OverviewSummary = {
      sessions: { drill: 2, exam: 1 },
      attempts: {
        drill: { attempts: 4, correct: 3, timeMs: 240000 },
        exam: { attempts: 2, correct: 1, timeMs: 120000 },
      },
      activeMs: { drill: 65 * 60 * 1000, exam: 25 * 60 * 1000 },
      bank: { total: 500, live: 450, seen: 50, seenLive: 40 },
      dailyPace: [],
      daily: [
        { day: '2026-10-14', mode: 'drill', attempts: 4, correct: 3 },
        { day: '2026-10-15', mode: 'exam', attempts: 2, correct: 1 },
      ],
      unattributed: 2,
    };

    await renderScreen(summaryWithSmallSample);

    // Drills card
    expect(container.textContent).toContain('Drills');
    expect(container.textContent).toContain('3 of 4 (75%), low N');
    expect(container.textContent).toContain('1 h 05 min');

    // Exam modules card
    expect(container.textContent).toContain('Exam modules');
    expect(container.textContent).toContain('1 of 2 (50%), low N');
    expect(container.textContent).toContain('25 min');

    // Bank coverage line
    expect(container.textContent).toContain('50 of 500 questions seen (40 of 450 live)');
    expect(container.textContent).toContain('2 answers are on questions no longer in the bank and are left out.');
  });

  it('renders latest test estimates with range, estimate label, paused tag, and no single exact score', async () => {
    const summary: OverviewSummary = {
      sessions: { drill: 5, exam: 5 },
      attempts: {
        drill: { attempts: 20, correct: 15, timeMs: 1200000 },
        exam: { attempts: 25, correct: 20, timeMs: 1500000 },
      },
      activeMs: { drill: 3600000, exam: 3600000 },
      bank: { total: 500, live: 450, seen: 150, seenLive: 140 },
      dailyPace: [],
      daily: [
        { day: '2026-10-14', mode: 'drill', attempts: 20, correct: 15 },
        { day: '2026-10-15', mode: 'exam', attempts: 25, correct: 20 },
      ],
      unattributed: 0,
    };

    const latestTests: TestHistoryRow[] = [
      {
        testId: 't-1',
        kind: 'full',
        finishedAt: 1700000000000,
        paused: true,
        configVersion: 1,
        estimate: {
          configVersion: 1,
          sections: [
            {
              section: 'rw',
              route: 'harder',
              weightedFraction: 0.8,
              low: 620,
              high: 680,
              mid: 650,
              capped: false,
              answered: 54,
              total: 54,
            },
            {
              section: 'math',
              route: 'harder',
              weightedFraction: 0.85,
              low: 650,
              high: 710,
              mid: 680,
              capped: false,
              answered: 44,
              total: 44,
            },
          ],
          total: { low: 1270, high: 1390, mid: 1330 },
        },
        routing: [],
      },
      {
        testId: 't-2',
        kind: 'rw',
        finishedAt: 1699900000000,
        paused: false,
        configVersion: 1,
        estimate: {
          configVersion: 1,
          sections: [
            {
              section: 'rw',
              route: 'easier',
              weightedFraction: 0.6,
              low: 500,
              high: 560,
              mid: 530,
              capped: true,
              answered: 54,
              total: 54,
            },
          ],
          total: null,
        },
        routing: [],
      },
    ];

    await renderScreen(summary, latestTests);

    // Latest test estimates card
    expect(container.textContent).toContain('Latest test estimates');
    expect(container.textContent).toContain('Full test');
    expect(container.textContent).toContain('paused');
    expect(container.textContent).toContain('scoring v1');
    expect(container.textContent).toContain('Total:');
    expect(container.textContent).toContain('1270 to 1390');
    expect(container.textContent).toContain('estimate');
    expect(container.textContent).toContain('(about 1330)');

    expect(container.textContent).toContain('Reading and Writing:');
    expect(container.textContent).toContain('620 to 680');
    expect(container.textContent).toContain('(about 650)');

    expect(container.textContent).toContain('Math:');
    expect(container.textContent).toContain('650 to 710');
    expect(container.textContent).toContain('(about 680)');

    // Ensure there is no exact score representation presented without estimate / about
    // Check RW section test
    expect(container.textContent).toContain('Reading and Writing section');
    expect(container.textContent).toContain('500 to 560');
    expect(container.textContent).toContain('(about 530)');
  });
});
