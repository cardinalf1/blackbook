import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigatorItem } from '../../types/exam';
import { NavigatorDrawer } from './NavigatorDrawer';

const createSyntheticItems = (count: number): NavigatorItem[] =>
  Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    answered: false,
    flagged: false,
  }));

describe('NavigatorDrawer', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders one button per item and has proper dialog attributes', async () => {
    const items = createSyntheticItems(22);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={0}
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Question navigator');

    const itemButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Question '),
    );
    expect(itemButtons).toHaveLength(22);

    await act(async () => {
      root.unmount();
    });
  });

  it('formats aria-labels including "answered", "unanswered", "flagged", and "current" correctly', async () => {
    const items: NavigatorItem[] = [
      { number: 1, answered: false, flagged: false },
      { number: 2, answered: true, flagged: false },
      { number: 3, answered: false, flagged: true },
      { number: 4, answered: true, flagged: true },
    ];

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={0} // Question 1 is current
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const getBtnLabel = (n: number) => {
      const btn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.getAttribute('aria-label')?.startsWith(`Question ${n},`),
      );
      return btn?.getAttribute('aria-label');
    };

    // Question 1: unanswered, not flagged, current
    expect(getBtnLabel(1)).toBe('Question 1, unanswered, current');
    // Question 2: answered, not flagged, not current
    expect(getBtnLabel(2)).toBe('Question 2, answered');
    // Question 3: unanswered, flagged, not current
    expect(getBtnLabel(3)).toBe('Question 3, unanswered, flagged');
    // Question 4: answered, flagged, not current
    expect(getBtnLabel(4)).toBe('Question 4, answered, flagged');

    // Switch currentIndex to Question 4 (index 3)
    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={3}
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    // Question 4: answered, flagged, current
    expect(getBtnLabel(4)).toBe('Question 4, answered, flagged, current');

    await act(async () => {
      root.unmount();
    });
  });

  it('marks current item with aria-current="true" and non-current without aria-current', async () => {
    const items = createSyntheticItems(5);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={2} // Question 3 is current
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Question '),
    );

    expect(buttons[0]?.getAttribute('aria-current')).toBeNull();
    expect(buttons[1]?.getAttribute('aria-current')).toBeNull();
    expect(buttons[2]?.getAttribute('aria-current')).toBe('true');
    expect(buttons[3]?.getAttribute('aria-current')).toBeNull();
    expect(buttons[4]?.getAttribute('aria-current')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onJump(4) when clicking question 5', async () => {
    const onJump = vi.fn();
    const items = createSyntheticItems(10);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={0}
          onJump={onJump}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const question5Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Question 5,'),
    );
    expect(question5Btn).toBeDefined();

    await act(async () => {
      question5Btn?.click();
    });

    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(4);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onClose on Escape key and on backdrop click and on close button', async () => {
    const onClose = vi.fn();
    const items = createSyntheticItems(3);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={0}
          onJump={vi.fn()}
          onClose={onClose}
          onGoToReview={vi.fn()}
        />,
      );
    });

    // Escape key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = container.querySelector('[data-testid="navigator-backdrop"]') as HTMLElement | null;
    expect(backdrop).not.toBeNull();
    await act(async () => {
      backdrop?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Close button click
    const closeBtn = container.querySelector('button[aria-label="Close navigator"]') as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(3);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onGoToReview when clicking "Go to review page"', async () => {
    const onGoToReview = vi.fn();
    const items = createSyntheticItems(3);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={0}
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={onGoToReview}
        />,
      );
    });

    const reviewBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Go to review page'),
    );
    expect(reviewBtn).toBeDefined();

    await act(async () => {
      reviewBtn?.click();
    });

    expect(onGoToReview).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('focuses the current question button when opened', async () => {
    const items = createSyntheticItems(10);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NavigatorDrawer
          items={items}
          currentIndex={4} // Question 5 is current
          onJump={vi.fn()}
          onClose={vi.fn()}
          onGoToReview={vi.fn()}
        />,
      );
    });

    const question5Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Question 5,'),
    );
    expect(question5Btn).toBeDefined();
    expect(document.activeElement).toBe(question5Btn);

    await act(async () => {
      root.unmount();
    });
  });
});
