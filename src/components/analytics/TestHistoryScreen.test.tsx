import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TestHistory } from '../../types/analytics';
import { TestHistoryScreen } from './TestHistoryScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

async function show(node: React.ReactElement) {
  await act(async () => {
    createRoot(container).render(node);
  });
}

const mockHistory: TestHistory = {
  tests: [
    {
      testId: 'test-1',
      kind: 'full',
      finishedAt: 1_700_000_000_000,
      paused: false,
      configVersion: 1,
      routing: [
        {
          section: 'rw',
          route: 'harder',
          weightedFraction: 0.85,
          threshold: 0.65,
          correct: 22,
          total: 27,
          configVersion: 1,
          at: 1_700_000_000_000,
        },
        {
          section: 'math',
          route: 'easier',
          weightedFraction: 0.5,
          threshold: 0.65,
          correct: 12,
          total: 22,
          configVersion: 1,
          at: 1_700_000_000_000,
        },
      ],
      estimate: {
        configVersion: 1,
        sections: [
          {
            section: 'rw',
            route: 'harder',
            weightedFraction: 0.82,
            low: 610,
            high: 690,
            mid: 650,
            capped: false,
            answered: 54,
            total: 54,
          },
          {
            section: 'math',
            route: 'easier',
            weightedFraction: 0.55,
            low: 480,
            high: 540,
            mid: 510,
            capped: true,
            answered: 44,
            total: 44,
          },
        ],
        total: {
          low: 1090,
          high: 1230,
          mid: 1160,
        },
      },
    },
    {
      testId: 'test-2',
      kind: 'full',
      finishedAt: 1_700_100_000_000,
      paused: true,
      configVersion: 2,
      routing: [
        {
          section: 'rw',
          route: 'harder',
          weightedFraction: 0.9,
          threshold: 0.65,
          correct: 24,
          total: 27,
          configVersion: 2,
          at: 1_700_100_000_000,
        },
        {
          section: 'math',
          route: 'harder',
          weightedFraction: 0.88,
          threshold: 0.65,
          correct: 20,
          total: 22,
          configVersion: 2,
          at: 1_700_100_000_000,
        },
      ],
      estimate: {
        configVersion: 2,
        sections: [
          {
            section: 'rw',
            route: 'harder',
            weightedFraction: 0.88,
            low: 650,
            high: 730,
            mid: 690,
            capped: false,
            answered: 54,
            total: 54,
          },
          {
            section: 'math',
            route: 'harder',
            weightedFraction: 0.85,
            low: 620,
            high: 700,
            mid: 660,
            capped: false,
            answered: 44,
            total: 44,
          },
        ],
        total: {
          low: 1270,
          high: 1430,
          mid: 1350,
        },
      },
    },
  ],
};

describe('TestHistoryScreen', () => {
  it('renders separate charts for RW, Math, and Total with estimate labels and mixed version warning', async () => {
    await show(<TestHistoryScreen history={mockHistory} />);

    // Separate section charts
    expect(container.textContent).toContain('Reading and Writing Score Estimates');
    expect(container.textContent).toContain('Math Score Estimates');
    expect(container.textContent).toContain('Total Score Estimates');

    // Warning banner for mixed versions (v1, v2)
    expect(container.textContent).toContain(
      'These estimates were made with different scoring settings (v1, v2) and are not comparable with each other.',
    );

    // Range labelled 'estimate', never single exact score
    expect(container.textContent).toContain('estimate 610 to 690');
    expect(container.textContent).toContain('estimate 480 to 540');
    expect(container.textContent).toContain('estimate 1090 to 1230');
    expect(container.textContent).toContain('estimate 1270 to 1430');

    // Routing outcome text
    expect(container.textContent).toContain('Module 2: harder');
    expect(container.textContent).toContain('Module 2: easier');

    // Paused tag
    expect(container.textContent).toContain('paused');

    // Scoring config version in legend
    expect(container.textContent).toContain('scoring v1');
    expect(container.textContent).toContain('scoring v2');
  });

  it('renders empty state when no finished tests', async () => {
    await show(<TestHistoryScreen history={{ tests: [] }} />);
    expect(container.textContent).toContain('No finished tests yet.');
  });
});
