import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHistoryRow } from '../../types/analytics';
import { TestsTable } from './TestsTable';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

async function show(node: React.ReactElement) {
  await act(async () => {
    root?.render(node);
  });
}

const mockTests: TestHistoryRow[] = [
  {
    testId: 'test-full-1',
    kind: 'full',
    finishedAt: 1773000000000,
    paused: false,
    configVersion: 1,
    estimate: {
      configVersion: 1,
      total: { low: 1420, high: 1510, mid: 1465 },
      sections: [
        {
          section: 'rw',
          route: 'harder',
          weightedFraction: 0.85,
          low: 700,
          high: 750,
          mid: 725,
          capped: false,
          answered: 54,
          total: 54,
        },
        {
          section: 'math',
          route: 'harder',
          weightedFraction: 0.88,
          low: 720,
          high: 760,
          mid: 740,
          capped: false,
          answered: 44,
          total: 44,
        },
      ],
    },
    routing: [
      {
        section: 'rw',
        route: 'harder',
        weightedFraction: 0.85,
        threshold: 0.65,
        correct: 22,
        total: 27,
        configVersion: 1,
        at: 1772990000000,
      },
      {
        section: 'math',
        route: 'harder',
        weightedFraction: 0.88,
        threshold: 0.65,
        correct: 19,
        total: 22,
        configVersion: 1,
        at: 1772995000000,
      },
    ],
  },
  {
    testId: 'test-rw-2',
    kind: 'rw',
    finishedAt: 1772900000000,
    paused: true,
    configVersion: 1,
    estimate: {
      configVersion: 1,
      total: null,
      sections: [
        {
          section: 'rw',
          route: 'easier',
          weightedFraction: 0.6,
          low: 680,
          high: 740,
          mid: 710,
          capped: true,
          answered: 54,
          total: 54,
        },
      ],
    },
    routing: [
      {
        section: 'rw',
        route: 'easier',
        weightedFraction: 0.55,
        threshold: 0.65,
        correct: 14,
        total: 27,
        configVersion: 1,
        at: 1772890000000,
      },
    ],
  },
  {
    testId: 'test-math-3',
    kind: 'math',
    finishedAt: 1772800000000,
    paused: false,
    configVersion: 1,
    estimate: null,
    routing: [],
  },
];

describe('TestsTable', () => {
  it('renders header with "Estimate (approximation)" and columns', async () => {
    await show(<TestsTable tests={mockTests} onOpenTest={vi.fn()} />);

    expect(container.textContent).toContain('Estimate (approximation)');
    expect(container.textContent).toContain('Date');
    expect(container.textContent).toContain('Kind');
    expect(container.textContent).toContain('Routing');
    expect(container.textContent).toContain('Paused');
  });

  it('renders estimate range for full test, section test, and "none" when null', async () => {
    await show(<TestsTable tests={mockTests} onOpenTest={vi.fn()} />);

    // Full test: total low-high
    expect(container.textContent).toContain('Full test');
    expect(container.textContent).toContain('1420–1510');

    // Section test: section low-high
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('680–740');

    // Math test with null estimate: 'none'
    expect(container.textContent).toContain('Math');
    expect(container.textContent).toContain('none');
  });

  it('renders routing decisions and paused status', async () => {
    await show(<TestsTable tests={mockTests} onOpenTest={vi.fn()} />);

    expect(container.textContent).toContain('R&W: harder, Math: harder');
    expect(container.textContent).toContain('R&W: easier');
    expect(container.textContent).toContain('—'); // empty routing

    expect(container.textContent).toContain('yes'); // paused
    expect(container.textContent).toContain('no'); // not paused
  });

  it('calls onOpenTest with testId when clicking Report button', async () => {
    const onOpenTest = vi.fn();
    await show(<TestsTable tests={mockTests} onOpenTest={onOpenTest} />);

    const reportButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Report',
    );
    expect(reportButtons.length).toBe(3);

    await act(async () => {
      reportButtons[0]?.click();
    });

    expect(onOpenTest).toHaveBeenCalledTimes(1);
    expect(onOpenTest).toHaveBeenCalledWith('test-full-1');

    await act(async () => {
      reportButtons[1]?.click();
    });

    expect(onOpenTest).toHaveBeenCalledTimes(2);
    expect(onOpenTest).toHaveBeenCalledWith('test-rw-2');
  });

  it('renders empty message when tests array is empty', async () => {
    await show(<TestsTable tests={[]} onOpenTest={vi.fn()} />);

    expect(container.textContent).toContain('No finished tests in this period.');
    expect(container.querySelector('table')).toBeNull();
  });
});
