import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigatorItem } from '../../types/exam';
import { ExamReview } from './ExamReview';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ExamReview', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const sampleItems: NavigatorItem[] = [
    { number: 1, answered: true, flagged: false },
    { number: 2, answered: true, flagged: true },
    { number: 3, answered: false, flagged: true },
    { number: 4, answered: false, flagged: false },
    { number: 5, answered: true, flagged: false },
  ];

  it('renders "3 of 5 answered" summary, title, and countdown', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Section 1, Module 1: Reading and Writing"
          items={sampleItems}
          remainingMs={150000}
          onJump={vi.fn()}
          onSubmit={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).toContain('Section 1, Module 1: Reading and Writing');
    expect(container.textContent).toContain('Check your work');
    expect(container.textContent).toContain('Time left: 2:30');
    expect(container.textContent).toContain('3 of 5 answered');
    expect(container.textContent).toContain(
      'On test day, you would not be able to move on to the next module until time expires. Here you can submit now or keep working. Answers cannot be changed after you submit.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('shows unanswered and flagged lists with the right numbers and calls onJump(n - 1)', async () => {
    const onJump = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={sampleItems}
          remainingMs={60000}
          onJump={onJump}
          onSubmit={vi.fn()}
          busy={false}
        />,
      );
    });

    // Unanswered: numbers 3 and 4
    expect(container.textContent).toContain('Unanswered:');
    // Marked for review: numbers 2 and 3
    expect(container.textContent).toContain('Marked for review:');

    const allButtons = Array.from(container.querySelectorAll('button'));
    const unansweredBtn = allButtons.find(
      (b) =>
        b.textContent?.trim() === '3' &&
        b.closest('div')?.parentElement?.textContent?.includes('Unanswered:'),
    );
    expect(unansweredBtn).toBeDefined();

    await act(async () => {
      unansweredBtn?.click();
    });

    expect(onJump).toHaveBeenCalledWith(2); // number 3 - 1

    const flaggedBtn = allButtons.find(
      (b) =>
        b.textContent?.trim() === '2' &&
        b.closest('div')?.parentElement?.textContent?.includes('Marked for review:'),
    );
    expect(flaggedBtn).toBeDefined();

    await act(async () => {
      flaggedBtn?.click();
    });

    expect(onJump).toHaveBeenCalledWith(1); // number 2 - 1

    await act(async () => {
      root.unmount();
    });
  });

  it('omits unanswered and flagged lists when there are none', async () => {
    const allAnsweredNoFlags: NavigatorItem[] = [
      { number: 1, answered: true, flagged: false },
      { number: 2, answered: true, flagged: false },
    ];
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={allAnsweredNoFlags}
          remainingMs={60000}
          onJump={vi.fn()}
          onSubmit={vi.fn()}
          busy={false}
        />,
      );
    });

    expect(container.textContent).not.toContain('Unanswered:');
    expect(container.textContent).not.toContain('Marked for review:');

    await act(async () => {
      root.unmount();
    });
  });

  it('formats grid button aria-labels correctly and handles click', async () => {
    const onJump = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={sampleItems}
          remainingMs={60000}
          onJump={onJump}
          onSubmit={vi.fn()}
          busy={false}
        />,
      );
    });

    // 1: answered, not flagged
    expect(container.querySelector('button[aria-label="Question 1, answered"]')).not.toBeNull();
    // 2: answered, flagged
    expect(
      container.querySelector('button[aria-label="Question 2, answered, marked for review"]'),
    ).not.toBeNull();
    // 3: unanswered, flagged
    expect(
      container.querySelector('button[aria-label="Question 3, unanswered, marked for review"]'),
    ).not.toBeNull();
    // 4: unanswered, not flagged
    expect(container.querySelector('button[aria-label="Question 4, unanswered"]')).not.toBeNull();

    // Clicking grid button 4 calls onJump(3)
    const btn4 = container.querySelector(
      'button[aria-label="Question 4, unanswered"]',
    ) as HTMLButtonElement | null;
    await act(async () => {
      btn4?.click();
    });
    expect(onJump).toHaveBeenCalledWith(3);

    await act(async () => {
      root.unmount();
    });
  });

  it('opens confirmation dialog on "Submit module" without calling onSubmit, and Cancel closes it', async () => {
    const onSubmit = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={sampleItems}
          remainingMs={60000}
          onJump={vi.fn()}
          onSubmit={onSubmit}
          busy={false}
        />,
      );
    });

    const submitModuleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit module'),
    );
    expect(submitModuleBtn).toBeDefined();

    await act(async () => {
      submitModuleBtn?.click();
    });

    expect(onSubmit).not.toHaveBeenCalled();

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Submit this module? You cannot come back to it.');

    const cancelBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Cancel'),
    );
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onSubmit once when clicking Submit inside confirmation', async () => {
    const onSubmit = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={sampleItems}
          remainingMs={60000}
          onJump={vi.fn()}
          onSubmit={onSubmit}
          busy={false}
        />,
      );
    });

    const submitModuleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit module'),
    );
    await act(async () => {
      submitModuleBtn?.click();
    });

    const dialog = container.querySelector('[role="alertdialog"]');
    const submitInsideBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Submit',
    );
    expect(submitInsideBtn).toBeDefined();

    await act(async () => {
      submitInsideBtn?.click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows "Submitting..." and disables buttons when busy is true', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamReview
          title="Module 1"
          items={sampleItems}
          remainingMs={60000}
          onJump={vi.fn()}
          onSubmit={vi.fn()}
          busy={true}
        />,
      );
    });

    expect(container.textContent).toContain('Submitting...');
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submitting...'),
    );
    expect(submitBtn?.disabled).toBe(true);

    const buttons = Array.from(container.querySelectorAll('button'));
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }

    await act(async () => {
      root.unmount();
    });
  });
});
