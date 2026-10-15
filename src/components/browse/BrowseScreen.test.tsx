import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowseRow } from '../../types/browse';
import { BrowseScreen } from './BrowseScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const rowFreshRw: BrowseRow = {
    id: 'q-fresh-rw',
    displayId: '001',
    section: 'rw',
    domainCode: 'd1',
    domain: 'Domain 1',
    skillCode: 's1',
    skill: 'Skill 1',
    difficulty: 'E',
    format: 'mcq',
    source: 'digital',
    active: true,
    status: 'unseen',
    examShown: false,
    attempts: 0,
    lastResult: null,
    flagged: false,
  };

  const rowFreshMath: BrowseRow = {
    id: 'q-fresh-math',
    displayId: '002',
    section: 'math',
    domainCode: 'd2',
    domain: 'Domain 2',
    skillCode: 's2',
    skill: 'Skill 2',
    difficulty: 'M',
    format: 'spr',
    source: 'digital',
    active: true,
    status: 'unseen',
    examShown: false,
    attempts: 0,
    lastResult: null,
    flagged: false,
  };

  return {
    rowFreshRw,
    rowFreshMath,
    session: null as unknown,
    startSingle: vi.fn(),
    loadPoolHealth: vi.fn(),
  };
});

vi.mock('../../stores/drillStore', () => ({
  drillStore: {
    getState: () => ({
      session: mocks.session,
      startSingle: mocks.startSingle,
      closeFinished: vi.fn(),
      error: null,
    }),
  },
  useDrill: (selector: (state: { error: string | null }) => unknown) => selector({ error: null }),
}));

vi.mock('../../services/browse/rows', () => ({
  loadRows: vi.fn().mockImplementation(async () => [mocks.rowFreshRw, mocks.rowFreshMath]),
}));

vi.mock('../../services/retry/load', () => ({
  loadPoolHealth: () => mocks.loadPoolHealth(),
}));

vi.mock('../drill/DrillFlow', () => ({
  PlayScreen: ({ onExit }: { onExit: () => void }) => (
    <div data-testid="play-screen">
      PlayScreen Component
      <button onClick={onExit}>Exit</button>
    </div>
  ),
  ReportScreen: () => <div>ReportScreen Component</div>,
}));

describe('BrowseScreen', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mocks.session = null;
    mocks.startSingle.mockReset();
    mocks.startSingle.mockImplementation(async () => {
      mocks.session = { id: 'sess-1' };
    });
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

  it('shows warning line above question when remaining pool health is under 3 tests for fresh/soft question', async () => {
    mocks.loadPoolHealth.mockResolvedValue({
      fresh: { rw: 2, math: 10, full: 2, capped: false },
      withSeen: { rw: 5, math: 15, full: 5, capped: false },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<BrowseScreen onBack={vi.fn()} onMySkills={vi.fn()} />);
    });

    // Wait for rows to load
    const practiceBtns = container.querySelectorAll('button[aria-label^="Practice question"]');
    expect(practiceBtns.length).toBe(2);

    // Click practice for fresh RW question (which has poolHealth.fresh.rw = 2 < 3)
    await act(async () => {
      (practiceBtns[0] as HTMLButtonElement).click();
    });

    expect(mocks.startSingle).toHaveBeenCalledWith('q-fresh-rw');
    expect(container.textContent).toContain('Doing this removes it from future full tests.');
    expect(container.querySelector('[data-testid="play-screen"]')).not.toBeNull();
  });

  it('does not show warning when remaining pool health is 3 or more', async () => {
    mocks.loadPoolHealth.mockResolvedValue({
      fresh: { rw: 5, math: 10, full: 5, capped: false },
      withSeen: { rw: 8, math: 15, full: 8, capped: false },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<BrowseScreen onBack={vi.fn()} onMySkills={vi.fn()} />);
    });

    const practiceBtns = container.querySelectorAll('button[aria-label^="Practice question"]');
    await act(async () => {
      (practiceBtns[0] as HTMLButtonElement).click();
    });

    expect(container.textContent).not.toContain('Doing this removes it from future full tests.');
    expect(container.querySelector('[data-testid="play-screen"]')).not.toBeNull();
  });
});
