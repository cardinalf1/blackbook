import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mistakeLoad from '../../services/mistakes/load';
import type { MistakeLogRow } from '../../types/mistakes';
import { MistakeLogScreen } from './MistakeLogScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/mistakes/load', () => ({
  loadMistakeLog: vi.fn(),
}));

function simulateInput(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('MistakeLogScreen', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
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

  const mockRows: MistakeLogRow[] = [
    {
      tag: {
        id: 'tag-1',
        sessionId: 'session-a',
        questionId: 'q-1',
        reason: 'careless',
        note: 'Misread the symbol',
        suggested: false,
        at: new Date('2025-01-15T12:00:00Z').getTime(),
      },
      versions: 1,
      section: 'math',
      domain: 'ALG',
      skillCode: 'ALG.LINEAR',
      skill: 'Linear Equations',
      difficulty: 'M',
      displayId: '101',
    },
    {
      tag: {
        id: 'tag-2',
        sessionId: 'session-b',
        questionId: 'q-2',
        reason: 'concept_gap',
        note: '',
        suggested: true,
        at: new Date('2025-01-20T12:00:00Z').getTime(),
      },
      versions: 2,
      section: 'rw',
      domain: 'CAS',
      skillCode: 'CAS.WORDS',
      skill: 'Words in Context',
      difficulty: 'H',
      displayId: '102',
    },
    {
      tag: {
        id: 'tag-3',
        sessionId: 'session-c',
        questionId: 'q-3',
        reason: 'ran_out_of_time',
        note: 'Timer hit 0',
        suggested: false,
        at: new Date('2025-02-01T12:00:00Z').getTime(),
      },
      versions: 3,
      section: 'math',
      domain: 'GEO',
      skillCode: 'GEO.TRIG',
      skill: 'Trigonometry',
      difficulty: 'E',
      displayId: '103',
    },
  ];

  it('loads and displays reason counts and mistake items', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    const onBack = vi.fn();
    const onOpenReport = vi.fn();

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={onBack} onOpenReport={onOpenReport} />);
    });

    expect(container.textContent).toContain('Mistake log');
    expect(container.textContent).toContain('3 tagged mistakes recorded');

    // Counts check
    expect(container.textContent).toContain('Careless');
    expect(container.textContent).toContain('Concept gap');
    expect(container.textContent).toContain('Ran out of time');

    // Rows check
    expect(container.textContent).toContain('#101');
    expect(container.textContent).toContain('Linear Equations');
    expect(container.textContent).toContain('Misread the symbol');

    expect(container.textContent).toContain('#102');
    expect(container.textContent).toContain('Words in Context');

    expect(container.textContent).toContain('#103');
    expect(container.textContent).toContain('Trigonometry');
  });

  it('shows (changed N times) when versions > 1', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    expect(container.textContent).not.toContain('(changed 1 times)');
    expect(container.textContent).toContain('(changed 2 times)');
    expect(container.textContent).toContain('(changed 3 times)');
  });

  it('filters by reason', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    const reasonSelect = container.querySelector(
      'select[aria-label="Filter by reason"]',
    ) as HTMLSelectElement;
    expect(reasonSelect).not.toBeNull();

    await act(async () => {
      reasonSelect.value = 'careless';
      reasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('#101');
    expect(container.textContent).not.toContain('#102');
    expect(container.textContent).not.toContain('#103');
  });

  it('filters by skill', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    const skillSelect = container.querySelector(
      'select[aria-label="Filter by skill"]',
    ) as HTMLSelectElement;
    expect(skillSelect).not.toBeNull();

    await act(async () => {
      skillSelect.value = 'CAS.WORDS';
      skillSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('#101');
    expect(container.textContent).toContain('#102');
    expect(container.textContent).not.toContain('#103');
  });

  it('filters by difficulty', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    const diffSelect = container.querySelector(
      'select[aria-label="Filter by difficulty"]',
    ) as HTMLSelectElement;
    expect(diffSelect).not.toBeNull();

    await act(async () => {
      diffSelect.value = 'E';
      diffSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('#101');
    expect(container.textContent).not.toContain('#102');
    expect(container.textContent).toContain('#103');
  });

  it('filters by date range', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    const fromInput = container.querySelector('input[aria-label="From date"]') as HTMLInputElement;
    const toInput = container.querySelector('input[aria-label="To date"]') as HTMLInputElement;

    await act(async () => {
      simulateInput(fromInput, '2025-01-18');
      simulateInput(toInput, '2025-01-25');
    });

    expect(container.textContent).not.toContain('#101');
    expect(container.textContent).toContain('#102');
    expect(container.textContent).not.toContain('#103');
  });

  it('calls onOpenReport with sessionId when clicking Open report', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    const onOpenReport = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={onOpenReport} />);
    });

    const openBtns = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent === 'Open report',
    );
    expect(openBtns.length).toBe(3);

    await act(async () => {
      openBtns[0]?.click();
    });

    expect(onOpenReport).toHaveBeenCalledWith('session-a');
  });

  it('calls onBack when clicking Back button', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    const onBack = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={onBack} onOpenReport={vi.fn()} />);
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Back',
    );
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(onBack).toHaveBeenCalled();
  });

  it('displays honest empty state when no tags exist', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: [],
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    expect(container.textContent).toContain('No mistake tags recorded yet.');
  });

  it('displays honest empty state when filters match nothing', async () => {
    vi.mocked(mistakeLoad.loadMistakeLog).mockResolvedValueOnce({
      rows: mockRows,
      browse: new Map(),
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<MistakeLogScreen onBack={vi.fn()} onOpenReport={vi.fn()} />);
    });

    const reasonSelect = container.querySelector(
      'select[aria-label="Filter by reason"]',
    ) as HTMLSelectElement;

    await act(async () => {
      reasonSelect.value = 'guessed';
      reasonSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('No mistake tags match the selected filters.');
  });
});
