import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { ExamQuestionPaneProps } from '../../types/exam';
import { RwSplitPane } from './RwSplitPane';

const mcqWithStimulus = syntheticQuestions.find(
  (q) => q.section === 'rw' && q.stimulusHtml !== null && q.answer.kind === 'mcq',
)!;
const mcqWithoutStimulus = syntheticQuestions.find(
  (q) => q.section === 'rw' && q.stimulusHtml === null && q.answer.kind === 'mcq',
)!;
const sprQuestion = syntheticQuestions.find((q) => q.answer.kind === 'spr')!;

describe('RwSplitPane', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
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

  const createProps = (overrides: Partial<ExamQuestionPaneProps> = {}): ExamQuestionPaneProps => ({
    question: mcqWithStimulus,
    number: 1,
    response: null,
    onSelect: vi.fn(),
    struck: [],
    onStrike: vi.fn(),
    flagged: false,
    onToggleFlag: vi.fn(),
    ...overrides,
  });

  it('renders the stimulus in a separate column, and no "Correct"/"Incorrect"/"Explanation" text appears', async () => {
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ response: 'B' })} />);
    });

    const splitGrid = container.querySelector('.grid-cols-2');
    expect(splitGrid).not.toBeNull();

    // Left column has stimulus
    expect(container.textContent).toContain('urban gardens');
    // Right column has stem
    expect(container.textContent).toContain('Which choice best describes');

    // Never reveals correctness or explanation
    expect(container.textContent).not.toMatch(/Correct|Incorrect|Explanation/i);
  });

  it('renders a single column when stimulusHtml is null', async () => {
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ question: mcqWithoutStimulus })} />);
    });

    const splitGrid = container.querySelector('.grid-cols-2');
    expect(splitGrid).toBeNull();

    const singleCol = container.querySelector('.max-w-3xl');
    expect(singleCol).not.toBeNull();
    expect(container.textContent).toContain('cautious');
  });

  it('calls onSelect("B") when clicking choice B, and clicking selected choice does nothing', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ response: null, onSelect })} />);
    });

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
      root?.render(<RwSplitPane {...createProps({ response: 'B', onSelect })} />);
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
  });

  it('struck choice is disabled and strike button calls onStrike', async () => {
    const onStrike = vi.fn();
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ struck: ['A'], onStrike })} />);
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

    // Click restore on A
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

    // Click strike on B
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
  });

  it('toggles Mark for review and calls onToggleFlag', async () => {
    const onToggleFlag = vi.fn();
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ flagged: false, onToggleFlag })} />);
    });

    const flagButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('for review'));
    expect(flagButton).toBeDefined();
    expect(flagButton?.textContent).toContain('Mark for review');
    expect(flagButton?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      flagButton?.click();
    });

    expect(onToggleFlag).toHaveBeenCalledTimes(1);

    // Re-render flagged
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ flagged: true, onToggleFlag })} />);
    });

    const flagButtonAfter = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('for review'));
    expect(flagButtonAfter).toBeDefined();
    expect(flagButtonAfter?.textContent).toContain('Marked for review');
    expect(flagButtonAfter?.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders SprInput if question answer kind is spr', async () => {
    await act(async () => {
      root?.render(<RwSplitPane {...createProps({ question: sprQuestion, number: 3 })} />);
    });

    expect(container.textContent).toContain('Answer for question 3');
    expect(container.querySelector('input[inputmode="decimal"]')).not.toBeNull();
  });
});
