import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PastSessionRow } from '../../types/session';
import { PastDrills } from './PastDrills';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PastDrills', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const mockRows: PastSessionRow[] = [
    {
      id: 'session-1',
      finishedAt: 1700000000000,
      sectionLabel: 'Reading and Writing',
      filtersLabel: 'Craft and Structure · Hard',
      kindLabel: 'Drill',
      correct: 8,
      total: 10,
      totalActiveMs: 320000,
    },
    {
      id: 'session-2',
      finishedAt: 1700005000000,
      sectionLabel: 'Math',
      filtersLabel: 'Algebra · All skills',
      kindLabel: 'Drill',
      correct: 5,
      total: 5,
      totalActiveMs: 150000,
    },
  ];

  it('renders empty state when there are no past drills', async () => {
    const onBack = vi.fn();
    const onOpen = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<PastDrills rows={[]} onOpen={onOpen} onBack={onBack} />);
    });

    expect(container.textContent).toContain('Past drills');
    expect(container.textContent).toContain('No finished drills yet.');

    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back'),
    );
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders table rows and calls onOpen with the id when Open button is clicked', async () => {
    const onBack = vi.fn();
    const onOpen = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<PastDrills rows={mockRows} onOpen={onOpen} onBack={onBack} />);
    });

    expect(container.textContent).toContain('Past drills');
    expect(container.textContent).toContain('Reading and Writing');
    expect(container.textContent).toContain('Math');
    expect(container.textContent).toContain('Craft and Structure · Hard');
    expect(container.textContent).toContain('Algebra · All skills');
    expect(container.textContent).toContain('8 / 10 (80%)');
    expect(container.textContent).toContain('5 / 5 (100%)');

    const openButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim() === 'Open',
    );
    expect(openButtons.length).toBe(2);

    // Click first Open button
    await act(async () => {
      openButtons[0]?.click();
    });

    expect(onOpen).toHaveBeenCalledWith('session-1');

    // Click second Open button
    await act(async () => {
      openButtons[1]?.click();
    });

    expect(onOpen).toHaveBeenCalledWith('session-2');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onOpen when table row is clicked', async () => {
    const onOpen = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<PastDrills rows={mockRows} onOpen={onOpen} onBack={vi.fn()} />);
    });

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    await act(async () => {
      (rows[0] as HTMLElement).click();
    });

    expect(onOpen).toHaveBeenCalledWith('session-1');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders inProgressSlot when given, even when there are no past drills', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PastDrills
          rows={[]}
          inProgressSlot={<div data-testid="in-progress-slot">In progress placeholder</div>}
          onOpen={vi.fn()}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Past drills');
    expect(container.textContent).toContain('In progress placeholder');
    expect(container.textContent).toContain('No finished drills yet.');

    const slot = container.querySelector('[data-testid="in-progress-slot"]');
    expect(slot).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders inProgressSlot between header and table when past drills exist', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PastDrills
          rows={mockRows}
          inProgressSlot={<div data-testid="in-progress-slot">In progress placeholder</div>}
          onOpen={vi.fn()}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('In progress placeholder');
    expect(container.textContent).toContain('Reading and Writing');

    const slot = container.querySelector('[data-testid="in-progress-slot"]');
    expect(slot).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});

describe('PastDrills hide from analytics', () => {
  const rows: PastSessionRow[] = [
    { id: 'a', finishedAt: 1700000000000, sectionLabel: 'Math', filtersLabel: 'All', kindLabel: 'Drill', correct: 1, total: 2, totalActiveMs: 1000 },
    { id: 'b', finishedAt: 1700005000000, sectionLabel: 'Math', filtersLabel: 'All', kindLabel: 'Drill', correct: 2, total: 2, totalActiveMs: 1000 },
  ];
  const render = (over: Partial<{ hidden: Set<string>; showHidden: boolean }> = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const calls = { set: vi.fn(), before: vi.fn(), show: vi.fn() };
    act(() => {
      createRoot(container).render(
        <PastDrills
          rows={rows}
          onOpen={vi.fn()}
          onBack={vi.fn()}
          hiding={{ hidden: over.hidden ?? new Set(['b']), showHidden: over.showHidden ?? false, onShowHidden: calls.show, onSetHidden: calls.set, onHideBefore: calls.before }}
        />,
      );
    });
    return { container, calls };
  };
  const button = (c: HTMLElement, text: string) => [...c.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement;

  it('leaves hidden sessions out unless "show hidden" is on, and marks them', () => {
    expect(render().container.querySelectorAll('tbody tr')).toHaveLength(1);
    const { container } = render({ showHidden: true });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.textContent).toContain('Hidden');
    expect(container.textContent).toContain('Show hidden sessions (1)');
  });

  it('hides and shows one session (reversible)', () => {
    const { container, calls } = render({ showHidden: true });
    act(() => button(container, 'Hide from analytics').click());
    expect(calls.set).toHaveBeenCalledWith('a', true);
    act(() => button(container, 'Show in analytics').click());
    expect(calls.set).toHaveBeenCalledWith('b', false);
  });

  it('hides everything before a date only after confirmation', () => {
    const { container, calls } = render();
    act(() => button(container, 'Hide all sessions before...').click());
    expect(button(container, 'Hide them').disabled).toBe(true);
    const input = container.querySelector('input[aria-label="Hide sessions before"]') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '2026-10-01');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('still count as seen');
    act(() => button(container, 'Hide them').click());
    expect(calls.before).toHaveBeenCalledWith(new Date('2026-10-01T00:00:00').getTime());
  });
});
