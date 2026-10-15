import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamBottomBar } from './ExamBottomBar';

describe('ExamBottomBar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders label "Question 3 of 22"', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamBottomBar
          index={2}
          total={22}
          onBack={vi.fn()}
          onNext={vi.fn()}
          onOpenNavigator={vi.fn()}
          disabled={false}
        />,
      );
    });

    const counterButton = container.querySelector('button[aria-haspopup="dialog"]');
    expect(counterButton).not.toBeNull();
    expect(counterButton?.textContent).toContain('Question 3 of 22');

    await act(async () => {
      root.unmount();
    });
  });

  it('disables Back button at index 0 and enables when index > 0', async () => {
    const onBack = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ExamBottomBar
          index={0}
          total={22}
          onBack={onBack}
          onNext={vi.fn()}
          onOpenNavigator={vi.fn()}
          disabled={false}
        />,
      );
    });

    const backButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Back',
    );
    expect(backButton).toBeDefined();
    expect(backButton?.disabled).toBe(true);

    // Re-render at index 1
    await act(async () => {
      root.render(
        <ExamBottomBar
          index={1}
          total={22}
          onBack={onBack}
          onNext={vi.fn()}
          onOpenNavigator={vi.fn()}
          disabled={false}
        />,
      );
    });

    expect(backButton?.disabled).toBe(false);
    await act(async () => {
      backButton?.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows "Next" on earlier questions and "Review" on the last question', async () => {
    const onNext = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ExamBottomBar
          index={20}
          total={22}
          onBack={vi.fn()}
          onNext={onNext}
          onOpenNavigator={vi.fn()}
          disabled={false}
        />,
      );
    });

    const nextButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next',
    );
    expect(nextButton).toBeDefined();
    expect(nextButton?.disabled).toBe(false);

    await act(async () => {
      nextButton?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Re-render on last question: index 21 of 22
    await act(async () => {
      root.render(
        <ExamBottomBar
          index={21}
          total={22}
          onBack={vi.fn()}
          onNext={onNext}
          onOpenNavigator={vi.fn()}
          disabled={false}
        />,
      );
    });

    const reviewButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Review',
    );
    expect(reviewButton).toBeDefined();
    expect(reviewButton?.disabled).toBe(false);

    await act(async () => {
      reviewButton?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables Back and Next when disabled is true', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ExamBottomBar
          index={5}
          total={22}
          onBack={vi.fn()}
          onNext={vi.fn()}
          onOpenNavigator={vi.fn()}
          disabled={true}
        />,
      );
    });

    const backButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Back',
    );
    const nextButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next',
    );

    expect(backButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onOpenNavigator when clicking the counter button', async () => {
    const onOpenNavigator = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ExamBottomBar
          index={2}
          total={22}
          onBack={vi.fn()}
          onNext={vi.fn()}
          onOpenNavigator={onOpenNavigator}
          disabled={false}
        />,
      );
    });

    const counterButton = container.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement | null;
    expect(counterButton).not.toBeNull();

    await act(async () => {
      counterButton?.click();
    });

    expect(onOpenNavigator).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
