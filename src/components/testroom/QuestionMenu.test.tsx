import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigatorItem } from '../../types/exam';
import { QuestionMenu } from './QuestionMenu';

describe('QuestionMenu', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  const mockItems: NavigatorItem[] = [
    { number: 1, answered: true, flagged: false },
    { number: 2, answered: false, flagged: true },
    { number: 3, answered: false, flagged: false },
  ];

  it('renders states: solid for answered, dashed for unanswered, flagged marker, current marker', async () => {
    await act(async () => {
      root?.render(
        <QuestionMenu
          title="Math Questions"
          items={mockItems}
          currentIndex={1}
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('Math Questions');

    // Item 1: answered (solid, not dashed)
    const btn1 = container.querySelector('button[data-answered="true"]') as HTMLButtonElement | null;
    expect(btn1).not.toBeNull();
    expect(btn1?.textContent).toContain('1');
    expect(btn1?.className).toContain('border-zinc-200');

    // Item 2: unanswered (dashed), flagged, and current (currentIndex=1 => question 2)
    const btn2 = container.querySelector('button[data-unanswered="true"][data-current="true"]') as HTMLButtonElement | null;
    expect(btn2).not.toBeNull();
    expect(btn2?.textContent).toContain('2');
    expect(btn2?.className).toContain('border-dashed');

    const flagMarker = container.querySelector('[data-testid="flagged-marker"]');
    expect(flagMarker).not.toBeNull();

    const currentMarker = container.querySelector('[data-testid="current-marker"]');
    expect(currentMarker).not.toBeNull();
  });

  it('calls onJump with 0-based index when a question button is clicked', async () => {
    const onJump = vi.fn();
    await act(async () => {
      root?.render(
        <QuestionMenu
          title="Math Questions"
          items={mockItems}
          currentIndex={0}
          onJump={onJump}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const btn3 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '3',
    );
    expect(btn3).toBeDefined();

    await act(async () => {
      btn3?.click();
    });

    expect(onJump).toHaveBeenCalledWith(2);
  });

  it('calls onGoToReview when clicking Go to Review Page', async () => {
    const onGoToReview = vi.fn();
    await act(async () => {
      root?.render(
        <QuestionMenu
          title="Math Questions"
          items={mockItems}
          currentIndex={0}
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={onGoToReview}
        />,
      );
    });

    const reviewBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Go to Review Page',
    );
    expect(reviewBtn).toBeDefined();

    await act(async () => {
      reviewBtn?.click();
    });

    expect(onGoToReview).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root?.render(
        <QuestionMenu
          title="Math Questions"
          items={mockItems}
          currentIndex={0}
          onJump={vi.fn()}
          onClose={onClose}
          onGoToReview={vi.fn()}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
