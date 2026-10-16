import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { SessionRecord } from '../../types/session';
import { DrillPlay, type DrillPlayExtendedProps } from './DrillPlay';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mcqQuestion = syntheticQuestions.find((q) => q.answer.kind === 'mcq')!;
const sprQuestion = syntheticQuestions.find((q) => q.answer.kind === 'spr')!;

describe('DrillPlay', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const createProps = (overrides: Partial<DrillPlayExtendedProps> = {}): DrillPlayExtendedProps => ({
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

    await act(async () => {
      root.unmount();
    });
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

    expect(onSelect).toHaveBeenCalledWith('B');
    expect(onSelect).toHaveBeenCalledTimes(1);

    // Re-render with response: 'B'
    await act(async () => {
      root.render(<DrillPlay {...createProps({ response: 'B', onSelect })} />);
    });

    const choiceBSelected = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'))[1];

    await act(async () => {
      choiceBSelected?.click();
    });

    // Still only called once because it was already selected
    expect(onSelect).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('disables a struck choice and strike button calls onStrike', async () => {
    const onStrike = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<DrillPlay {...createProps({ struck: ['A'], onStrike })} />);
    });

    // Check choice A button is disabled
    const choiceA = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'))[0];
    expect(choiceA).toBeDefined();
    expect(choiceA?.disabled).toBe(true);

    // Find strike button for choice B (aria-label "Strike out choice B")
    const strikeB = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Strike out choice B"]',
    );
    expect(strikeB).toBeDefined();

    await act(async () => {
      strikeB?.click();
    });

    expect(onStrike).toHaveBeenCalledWith('B');

    // Find restore button for choice A (aria-label "Restore choice A")
    const restoreA = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Restore choice A"]',
    );
    expect(restoreA).toBeDefined();

    await act(async () => {
      restoreA?.click();
    });

    expect(onStrike).toHaveBeenCalledWith('A');

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
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

    const input = container.querySelector('input[type="text"]') as HTMLInputElement | null;
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

    await act(async () => {
      root.unmount();
    });
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

    await act(async () => {
      root.unmount();
    });
  });

  it('live pace hint is hidden by default and absent for exam sessions', async () => {
    const root = createRoot(container);

    // 1. In a drill session: checkbox is present, unchecked by default, hint text hidden
    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            index: 2,
            elapsedActiveMs: 140000,
            finishedCount: 2,
            session: { mode: 'drill' } as unknown as SessionRecord,
          })}
        />,
      );
    });

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);
    expect(container.textContent).toContain('Show pace hint');
    expect(container.textContent).not.toContain('On pace');
    expect(container.textContent).not.toContain('Ahead of pace');
    expect(container.textContent).not.toContain('Behind pace');

    // 2. Check the checkbox: hint text appears
    await act(async () => {
      checkbox?.click();
    });
    expect(checkbox?.checked).toBe(true);
    expect(container.textContent).toContain('On pace');

    // 3. For exam sessions: checkbox and hint are completely absent
    await act(async () => {
      root.render(
        <DrillPlay
          {...createProps({
            index: 2,
            elapsedActiveMs: 140000,
            finishedCount: 2,
            session: { mode: 'exam' } as unknown as SessionRecord,
          })}
        />,
      );
    });

    expect(container.textContent).not.toContain('Show pace hint');
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
