import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sparkline } from './Sparkline';
import { TrendChart } from './TrendChart';

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

describe('Sparkline', () => {
  it('writes out the values and the latest one', async () => {
    await show(<Sparkline values={[0.5, 0.75]} label="Accuracy over the last 2 sessions" />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Accuracy over the last 2 sessions: 50%, 75%');
    expect(container.textContent).toContain('75%');
  });
  it('says so when there is nothing to draw', async () => {
    await show(<Sparkline values={[]} label="x" />);
    expect(container.textContent).toBe('no trend');
  });
});

describe('TrendChart', () => {
  it('names each series with its latest value and marks the low-N rule', async () => {
    await show(
      <TrendChart
        label="Accuracy over time"
        series={[
          { id: 'drill', label: 'Drills', points: [{ x: 1_000, y: 0.5, n: 4 }, { x: 2_000, y: 0.8, n: 30 }] },
          { id: 'exam', label: 'Exam modules', points: [{ x: 1_500, y: 0.6, n: 22 }] },
        ]}
      />,
    );
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Accuracy over time');
    expect(container.textContent).toContain('Drills: latest 80% (30 answers)');
    expect(container.textContent).toContain('Exam modules: latest 60% (22 answers)');
    expect(container.textContent).toContain('hollow marker = fewer than 10 answers');
  });
  it('shows a message with no points', async () => {
    await show(<TrendChart label="x" series={[]} />);
    expect(container.textContent).toBe('No answers in this view yet.');
  });
});
