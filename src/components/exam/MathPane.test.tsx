import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { ExamQuestionPaneProps } from '../../types/exam';
import { MathPane } from './MathPane';

const sprQuestion = syntheticQuestions.find(
  (q) => q.section === 'math' && q.answer.kind === 'spr',
)!;
const mcqQuestion = syntheticQuestions.find(
  (q) => q.section === 'math' && q.answer.kind === 'mcq',
)!;
const mathWithStimulus = syntheticQuestions.find(
  (q) => q.section === 'math' && q.stimulusHtml !== null,
)!;

describe('MathPane', () => {
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
    question: sprQuestion,
    number: 5,
    response: null,
    onSelect: vi.fn(),
    struck: [],
    onStrike: vi.fn(),
    flagged: false,
    onToggleFlag: vi.fn(),
    ...overrides,
  });

  it('renders a single centered column and renders SprInput for spr questions', async () => {
    await act(async () => {
      root?.render(<MathPane {...createProps({ question: sprQuestion, number: 7 })} />);
    });

    const centeredCol = container.querySelector('.max-w-3xl');
    expect(centeredCol).not.toBeNull();

    // Shared header
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('Mark for review');

    // SprInput
    expect(container.textContent).toContain('Answer for question 7');
    expect(container.querySelector('input[inputmode="decimal"]')).not.toBeNull();

    // No MCQ choices
    expect(container.querySelector('ol')).toBeNull();
  });

  it('renders ChoiceList for mcq questions', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root?.render(
        <MathPane {...createProps({ question: mcqQuestion, number: 2, onSelect })} />,
      );
    });

    expect(container.querySelector('ol')).not.toBeNull();
    const choiceButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('ol button'),
    ).filter((btn) => !btn.getAttribute('aria-label')?.includes('choice'));
    expect(choiceButtons.length).toBe(4);

    const choiceA = choiceButtons[0];
    expect(choiceA).toBeDefined();

    await act(async () => {
      choiceA?.click();
    });

    expect(onSelect).toHaveBeenCalledWith('A');
  });

  it('renders stimulus when present', async () => {
    await act(async () => {
      root?.render(<MathPane {...createProps({ question: mathWithStimulus })} />);
    });

    // syn-0019 has an SVG graph
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toContain('The graph shows a linear model');
  });

  it('toggles Mark for review and calls onToggleFlag', async () => {
    const onToggleFlag = vi.fn();
    await act(async () => {
      root?.render(<MathPane {...createProps({ flagged: false, onToggleFlag })} />);
    });

    const flagButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('for review'));
    expect(flagButton?.textContent).toContain('Mark for review');
    expect(flagButton?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      flagButton?.click();
    });

    expect(onToggleFlag).toHaveBeenCalledTimes(1);

    await act(async () => {
      root?.render(<MathPane {...createProps({ flagged: true, onToggleFlag })} />);
    });

    const flagButtonAfter = Array.from(
      container.querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.includes('for review'));
    expect(flagButtonAfter?.textContent).toContain('Marked for review');
    expect(flagButtonAfter?.getAttribute('aria-pressed')).toBe('true');
  });

  it('never shows "Correct", "Incorrect", or "Explanation"', async () => {
    await act(async () => {
      root?.render(<MathPane {...createProps({ response: '1/4' })} />);
    });

    expect(container.textContent).not.toMatch(/Correct|Incorrect|Explanation/i);
  });
});
