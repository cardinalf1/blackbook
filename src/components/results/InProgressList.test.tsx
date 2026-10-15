import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InProgressRow } from '../../types/session';
import { InProgressList } from './InProgressList';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('InProgressList', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  const sampleRow: InProgressRow = {
    id: 'session-1',
    kindLabel: 'Drill',
    sectionLabel: 'Reading and Writing',
    filtersLabel: 'Craft and Structure · Hard',
    answered: 3,
    total: 20,
    activeMs: 125000,
    lastActivityAt: Date.now() - 5 * 60 * 1000,
  };

  it('renders nothing when rows is empty', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[]} onResume={vi.fn()} onDiscard={vi.fn()} />);
    });

    expect(container.innerHTML).toBe('');
    expect(container.firstChild).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders rows showing "3 of 20 answered" and kind label', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={vi.fn()} onDiscard={vi.fn()} />);
    });

    expect(container.textContent).toContain('In progress (1)');
    expect(container.textContent).toContain('Drill');
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('Craft and Structure · Hard');
    expect(container.textContent).toContain('3 of 20 answered');
    expect(container.textContent).toContain('2:05');

    const resumeBtn = container.querySelector(
      'button[aria-label="Resume Drill, 3 of 20 answered"]',
    );
    expect(resumeBtn).not.toBeNull();
    expect(resumeBtn?.textContent?.trim()).toBe('Resume');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onResume with the id when Resume is clicked', async () => {
    const onResume = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={onResume} onDiscard={vi.fn()} />);
    });

    const resumeBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resume Drill, 3 of 20 answered"]',
    );
    expect(resumeBtn).not.toBeNull();

    await act(async () => {
      resumeBtn?.click();
    });

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledWith('session-1');

    await act(async () => {
      root.unmount();
    });
  });

  it('opens confirmation dialog on Discard and does not call onDiscard', async () => {
    const onDiscard = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={vi.fn()} onDiscard={onDiscard} />);
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    const discardBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Discard',
    );
    expect(discardBtn).toBeDefined();

    await act(async () => {
      discardBtn?.click();
    });

    const alertdialog = container.querySelector('[role="alertdialog"]');
    expect(alertdialog).not.toBeNull();
    expect(alertdialog?.textContent).toContain(
      'Discard this unfinished session? It is kept as abandoned and will not count toward your skills.',
    );
    expect(onDiscard).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('closes confirmation dialog when Cancel is clicked', async () => {
    const onDiscard = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={vi.fn()} onDiscard={onDiscard} />);
    });

    const discardBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Discard',
    );
    await act(async () => {
      discardBtn?.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onDiscard).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onDiscard once with the id when confirming discard', async () => {
    const onDiscard = vi.fn().mockResolvedValue(undefined);
    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={vi.fn()} onDiscard={onDiscard} />);
    });

    const discardBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Discard',
    );
    await act(async () => {
      discardBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Discard',
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledWith('session-1');
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('shows "Discarding...", disables row buttons while pending, and shows error message on rejection', async () => {
    let rejectPromise!: (err: Error) => void;
    const discardPromise = new Promise<void>((_, reject) => {
      rejectPromise = reject;
    });
    const onDiscard = vi.fn().mockReturnValue(discardPromise);

    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[sampleRow]} onResume={vi.fn()} onDiscard={onDiscard} />);
    });

    const initialDiscardBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Discard',
    );
    await act(async () => {
      initialDiscardBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const confirmBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Discard',
    );

    await act(async () => {
      confirmBtn?.click();
    });

    expect(container.textContent).toContain('Discarding...');
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }

    await act(async () => {
      rejectPromise(new Error('Network error discarding session'));
    });

    expect(container.textContent).toContain('Network error discarding session');
    const errorEl = container.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toBe('Network error discarding session');
    expect(errorEl?.className).toContain('text-red-400');

    // Row is kept and buttons are re-enabled
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn?.disabled).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders relative time "5 min ago" for a row 5 minutes old', async () => {
    const fixedNow = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const fiveMinRow: InProgressRow = {
      ...sampleRow,
      lastActivityAt: fixedNow - 5 * 60 * 1000,
    };

    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={[fiveMinRow]} onResume={vi.fn()} onDiscard={vi.fn()} />);
    });

    expect(container.textContent).toContain('5 min ago');

    await act(async () => {
      root.unmount();
    });
  });

  it('formats other relative times accurately (just now, hours ago, and date string)', async () => {
    const fixedNow = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const rows: InProgressRow[] = [
      { ...sampleRow, id: 's-1', lastActivityAt: fixedNow - 25 * 1000 },
      { ...sampleRow, id: 's-2', lastActivityAt: fixedNow - 3 * 60 * 60 * 1000 },
      { ...sampleRow, id: 's-3', lastActivityAt: fixedNow - 50 * 60 * 60 * 1000 },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(<InProgressList rows={rows} onResume={vi.fn()} onDiscard={vi.fn()} />);
    });

    expect(container.textContent).toContain('just now');
    expect(container.textContent).toContain('3 h ago');
    expect(container.textContent).toContain(
      new Date(fixedNow - 50 * 60 * 60 * 1000).toLocaleDateString(),
    );

    await act(async () => {
      root.unmount();
    });
  });
});
