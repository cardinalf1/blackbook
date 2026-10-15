import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BehaviorSummary } from '../../types/analytics';
import { BehaviorScreen } from './BehaviorScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

async function show(node: React.ReactElement) {
  await act(async () => {
    createRoot(container).render(node);
  });
}

const mockBehaviorSummary: BehaviorSummary = {
  counts: {
    drill: {
      answered: 50,
      questionsWithChange: 12,
      changes: 15,
      correctToIncorrect: 3,
      incorrectToCorrect: 7,
      incorrectToIncorrect: 2,
      mcqAnswered: 45,
      questionsWithStrike: 18,
      strikeActions: 25,
      rated: 20,
      sureWrong: 2,
      sureRight: 10,
      unsureRight: 4,
      unsureWrong: 2,
      guessRight: 1,
      guessWrong: 1,
    },
    exam: {
      answered: 40,
      questionsWithChange: 8,
      changes: 9,
      correctToIncorrect: 5,
      incorrectToCorrect: 2,
      incorrectToIncorrect: 1,
      mcqAnswered: 38,
      questionsWithStrike: 10,
      strikeActions: 14,
      rated: 0,
      sureWrong: 0,
      sureRight: 0,
      unsureRight: 0,
      unsureWrong: 0,
      guessRight: 0,
      guessWrong: 0,
    },
  },
};

describe('BehaviorScreen', () => {
  it('renders separate drill and exam sections, swap breakdown with net effect, and N next to ratios', async () => {
    await show(<BehaviorScreen summary={mockBehaviorSummary} />);

    // Separate sections
    expect(container.textContent).toContain('Drills');
    expect(container.textContent).toContain('Exam modules');

    // Answers changed
    expect(container.textContent).toContain('Answers changed');
    expect(container.textContent).toContain('12 of 50');
    expect(container.textContent).toContain('15 changes total');

    // Swap breakdown and net effect
    expect(container.textContent).toContain('net +4 answers'); // 7 - 3 = +4
    expect(container.textContent).toContain('net -3 answers'); // 2 - 5 = -3
    expect(container.textContent).toContain('Wrong to right');
    expect(container.textContent).toContain('Right to wrong');
    expect(container.textContent).toContain('Wrong to wrong');

    // Strike-out usage
    expect(container.textContent).toContain('Strike-out usage');
    expect(container.textContent).toContain('18 of 45');
    expect(container.textContent).toContain('25 strike actions');

    // Confidence calibration when rated > 0
    expect(container.textContent).toContain('Sure but wrong');
    expect(container.textContent).toContain('Guess but right');

    // Hidden calibration when rated === 0
    expect(container.textContent).toContain('The confidence question was not asked in this view.');

    // N displayed next to ratios
    expect(container.textContent).toContain('(N = 50)');
    expect(container.textContent).toContain('(N = 45)');
    expect(container.textContent).toContain('(N = 20)');

    // Wording rules: 'changed answer', 'behavior, not reasoning', no forbidden terms
    expect(container.textContent).toContain('changed answer');
    expect(container.textContent).toContain('These counts describe behavior, not reasoning.');
    expect(container.textContent).not.toContain('second-guessing');
    expect(container.textContent).not.toContain('overthinking');
  });
});
