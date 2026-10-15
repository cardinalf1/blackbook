import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { ColumnGroups } from './ColumnGroups';
import { HBar } from './HBar';
import { RangeBars } from './RangeBars';

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

describe('RangeBars', () => {
  it('renders range text, labels, legend with group id, and notes', async () => {
    await show(
      <RangeBars
        label="Test Score Estimates"
        items={[
          {
            id: 'test-1',
            label: 'Oct 10 · full',
            low: 500,
            high: 580,
            mid: 540,
            groupId: 'v1',
            groupLabel: 'scoring v1',
            valueLabel: 'estimate 500 to 580',
            notes: ['paused', 'Module 2: harder'],
          },
          {
            id: 'test-2',
            label: 'Oct 12 · rw',
            low: 620,
            high: 700,
            mid: 660,
            groupId: 'v2',
            groupLabel: 'scoring v2',
            valueLabel: 'estimate 620 to 700',
          },
        ]}
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Test Score Estimates');
    expect(container.textContent).toContain('Oct 10 · full');
    expect(container.textContent).toContain('estimate 500 to 580');
    expect(container.textContent).toContain('paused · Module 2: harder');
    expect(container.textContent).toContain('scoring v1');
    expect(container.textContent).toContain('scoring v2');
    expect(container.textContent).toContain('mid tick = estimate midpoint');
  });

  it('renders empty message when no items', async () => {
    await show(<RangeBars label="Empty" items={[]} />);
    expect(container.textContent).toBe('No test data in this view yet.');
  });
});

describe('HBar', () => {
  it('renders horizontal bars with labels and formatted value text', async () => {
    await show(
      <HBar
        label="Swap breakdown"
        items={[
          { id: 'w2r', label: 'Wrong to right', value: 8, valueText: '8 answers' },
          { id: 'r2w', label: 'Right to wrong', value: 3, valueText: '3 answers' },
        ]}
      />,
    );

    expect(container.textContent).toContain('Wrong to right');
    expect(container.textContent).toContain('8 answers');
    expect(container.textContent).toContain('Right to wrong');
    expect(container.textContent).toContain('3 answers');
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars.length).toBe(2);
  });

  it('handles empty items list', async () => {
    await show(<HBar label="Empty" items={[]} />);
    expect(container.textContent).toBe('No data available.');
  });
});

describe('ColumnGroups', () => {
  it('renders groups, series columns with values written on top, and legend', async () => {
    await show(
      <ColumnGroups
        label="Mean time per answer"
        series={[
          { id: 'drill', label: 'Drills' },
          { id: 'exam', label: 'Exam modules' },
        ]}
        groups={[
          {
            id: 'easy',
            label: 'Easy',
            data: [
              { seriesId: 'drill', value: 45, valueText: '0:45' },
              { seriesId: 'exam', value: 65, valueText: '1:05' },
            ],
          },
          {
            id: 'hard',
            label: 'Hard',
            data: [
              { seriesId: 'drill', value: 90, valueText: '1:30' },
              { seriesId: 'exam', value: 120, valueText: '2:00' },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Mean time per answer');
    expect(container.textContent).toContain('Easy');
    expect(container.textContent).toContain('Hard');
    expect(container.textContent).toContain('0:45');
    expect(container.textContent).toContain('1:05');
    expect(container.textContent).toContain('1:30');
    expect(container.textContent).toContain('2:00');
    expect(container.textContent).toContain('Drills');
    expect(container.textContent).toContain('Exam modules');
  });

  it('handles empty groups list', async () => {
    await show(<ColumnGroups label="Empty" groups={[]} series={[]} />);
    expect(container.textContent).toBe('No timing data in this view yet.');
  });
});
