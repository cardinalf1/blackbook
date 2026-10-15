import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { DrillPlayProps } from '../../types/session';
import { DrillPlay } from './DrillPlay';

const mcqQuestion = syntheticQuestions.find((q) => q.answer.kind === 'mcq')!;
const sprQuestion = syntheticQuestions.find((q) => q.answer.kind === 'spr')!;

describe('DrillPlay', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const createProps = (overrides: Partial<DrillPlayProps> = {}): DrillPlayProps => ({
    question: mcqQuestion,
    index: 0,
    total: 5,
    response: null,
    onSelect: vi.fn(),
    struck: [],
    onStrike: vi.fn(),
    flagged: false,
    onToggleFlag: vi.fn(),
    askConfidence: false,
    confidence: null,
    onRate: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    saving: false,
    saveError: null,
    onRetry: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  });

  it('never shows "Correct", "Incorrect", or "Explanation" even with a response', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<DrillPlay {...createProps({ response: 'B' })} />);
    });

    expect(container.textContent).not.toMatch(/Correct|Incorrect|Explanation/i);

    root.unmount();
  });

  it('calls onSelect("B") when clicking choice B, but does not call onSelect when clicking the already-selected choice', async () => {
    const onSelect = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ response: null, onSelect })} />);
    });

    // Find choice B button: choices A-D are buttons with the letter inside a span
    const choiceButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'));
    expect(choiceButtons.length).toBe(4);

    const choiceB = choiceButtons[1];
    expect(choiceB).toBeDefined();
    expect(choiceB?.textContent).toContain('B');

    await act(async () => {
      choiceB?.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('B');

    // Re-render with response: 'B'
    onSelect.mockClear();
    await act(async () => {
      root.render(<DrillPlay {...createProps({ response: 'B', onSelect })} />);
    });

    const choiceButtonsAfter = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'));
    const choiceBSelected = choiceButtonsAfter[1];
    expect(choiceBSelected).toBeDefined();
    expect(choiceBSelected?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      choiceBSelected?.click();
    });

    expect(onSelect).not.toHaveBeenCalled();

    root.unmount();
  });

  it('disables a struck choice and strike button calls onStrike', async () => {
    const onStrike = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ struck: ['A'], onStrike })} />);
    });

    const choiceButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'));
    const choiceA = choiceButtons[0];
    const choiceB = choiceButtons[1];

    expect(choiceA).toBeDefined();
    expect(choiceB).toBeDefined();
    expect(choiceA?.disabled).toBe(true);
    expect(choiceB?.disabled).toBe(false);

    // Click strike/restore button for choice A
    const strikeA = container.querySelector(
      'button[aria-label="Restore choice A"]',
    ) as HTMLButtonElement | null;
    expect(strikeA).not.toBeNull();
    expect(strikeA?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      strikeA?.click();
    });

    expect(onStrike).toHaveBeenCalledTimes(1);
    expect(onStrike).toHaveBeenCalledWith('A');

    // Click strike button for choice B
    const strikeB = container.querySelector(
      'button[aria-label="Strike out choice B"]',
    ) as HTMLButtonElement | null;
    expect(strikeB).not.toBeNull();
    expect(strikeB?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      strikeB?.click();
    });

    expect(onStrike).toHaveBeenCalledTimes(2);
    expect(onStrike).toHaveBeenCalledWith('B');

    root.unmount();
  });

  it('disables Back button on index 0, enables on index > 0, and calls onBack', async () => {
    const onBack = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ index: 0, total: 5, onBack })} />);
    });

    const backBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Back');
    expect(backBtn).toBeDefined();
    expect(backBtn?.disabled).toBe(true);

    // Re-render on index 1
    await act(async () => {
      root.render(<DrillPlay {...createProps({ index: 1, total: 5, onBack })} />);
    });

    const backBtnAfter = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Back');
    expect(backBtnAfter?.disabled).toBe(false);

    await act(async () => {
      backBtnAfter?.click();
    });

    expect(onBack).toHaveBeenCalledTimes(1);

    root.unmount();
  });

  it('shows "Next" on earlier questions and "Finish" on the last question, calling onNext', async () => {
    const onNext = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ index: 0, total: 3, onNext })} />);
    });

    const nextBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Next');
    expect(nextBtn).toBeDefined();

    await act(async () => {
      nextBtn?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Last question
    await act(async () => {
      root.render(<DrillPlay {...createProps({ index: 2, total: 3, onNext })} />);
    });

    const finishBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Finish');
    expect(finishBtn).toBeDefined();

    await act(async () => {
      finishBtn?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(2);

    root.unmount();
  });

  it('disables navigation buttons and displays "Saving..." while saving', async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ index: 1, total: 5, saving: true })} />);
    });

    const backBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Back');
    expect(backBtn?.disabled).toBe(true);

    const savingBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Saving...');
    expect(savingBtn).toBeDefined();
    expect(savingBtn?.disabled).toBe(true);

    root.unmount();
  });

  it('renders saveError banner, calls onRetry on Retry click, and disables Next', async () => {
    const onRetry = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            index: 1,
            total: 5,
            saveError: 'Could not save attempt',
            onRetry,
          })}
        />,
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Could not save attempt');

    const retryBtn = alert?.querySelector<HTMLButtonElement>('button');
    expect(retryBtn).toBeDefined();
    expect(retryBtn?.textContent).toContain('Retry');

    await act(async () => {
      retryBtn?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    const nextBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('footer button'),
    ).find((b) => b.textContent?.trim() === 'Next');
    expect(nextBtn?.disabled).toBe(true);

    root.unmount();
  });

  it('shows confidence group only when askConfidence is true and response is provided, and calls onRate("sure")', async () => {
    const onRate = vi.fn();
    const root = createRoot(container);

    // askConfidence false -> hidden even with response
    await act(async () => {
      root.render(<DrillPlay {...createProps({ askConfidence: false, response: 'A', onRate })} />);
    });
    expect(container.textContent).not.toContain('How sure are you?');

    // askConfidence true but response is null -> hidden
    await act(async () => {
      root.render(<DrillPlay {...createProps({ askConfidence: true, response: null, onRate })} />);
    });
    expect(container.textContent).not.toContain('How sure are you?');

    // askConfidence true but response is empty string -> hidden
    await act(async () => {
      root.render(<DrillPlay {...createProps({ askConfidence: true, response: '', onRate })} />);
    });
    expect(container.textContent).not.toContain('How sure are you?');

    // askConfidence true and response provided -> shown
    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            askConfidence: true,
            response: 'C',
            confidence: 'sure',
            onRate,
          })}
        />,
      );
    });
    expect(container.textContent).toContain('How sure are you?');

    const sureBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === 'Sure',
    );
    expect(sureBtn).toBeDefined();
    expect(sureBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      sureBtn?.click();
    });
    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onRate).toHaveBeenCalledWith('sure');

    root.unmount();
  });

  it('renders SPR input, never shows accepted answers, and calls onSelect with typed value', async () => {
    const onSelect = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            question: sprQuestion,
            response: '12',
            onSelect,
          })}
        />,
      );
    });

    expect(container.textContent).toContain('Your answer');
    expect(container.textContent).not.toContain('accepted:');

    const input = container.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe('12');
    expect(input?.maxLength).toBe(6);
    expect(input?.inputMode).toBe('decimal');

    // Type into input
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;

    await act(async () => {
      if (input) {
        nativeSetter?.call(input, '15');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onSelect).toHaveBeenCalledWith('15');

    root.unmount();
  });

  it('handles flag button toggle and exit button', async () => {
    const onToggleFlag = vi.fn();
    const onExit = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            flagged: false,
            onToggleFlag,
            onExit,
          })}
        />,
      );
    });

    const flagBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('Flag for review'));
    expect(flagBtn).toBeDefined();
    expect(flagBtn?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      flagBtn?.click();
    });
    expect(onToggleFlag).toHaveBeenCalledTimes(1);

    // Re-render with flagged: true
    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            flagged: true,
            onToggleFlag,
            onExit,
          })}
        />,
      );
    });

    const flaggedBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('Flagged'));
    expect(flaggedBtn).toBeDefined();
    expect(flaggedBtn?.getAttribute('aria-pressed')).toBe('true');

    // Click Save and exit
    const exitBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((b) => b.textContent?.includes('Save and exit'));
    expect(exitBtn).toBeDefined();

    await act(async () => {
      exitBtn?.click();
    });
    expect(onExit).toHaveBeenCalledTimes(1);

    root.unmount();
  });
});
