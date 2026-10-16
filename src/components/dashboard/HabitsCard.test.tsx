import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BehaviorCounts } from '../../types/analytics';
import type { HabitsSection } from '../../types/dashboard';
import { HabitsCard } from './HabitsCard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

async function show(node: React.ReactElement) {
  await act(async () => {
    root?.render(node);
  });
}

function makeBehaviorCounts(overrides: Partial<BehaviorCounts> = {}): BehaviorCounts {
  return {
    answered: 20,
    questionsWithChange: 5,
    changes: 5,
    correctToIncorrect: 0,
    incorrectToCorrect: 0,
    incorrectToIncorrect: 0,
    mcqAnswered: 20,
    questionsWithStrike: 0,
    strikeActions: 0,
    rated: 0,
    sureWrong: 0,
    sureRight: 0,
    unsureRight: 0,
    unsureWrong: 0,
    guessRight: 0,
    guessWrong: 0,
    ...overrides,
  };
}

const mockHabitsSufficient: HabitsSection = {
  behavior: {
    drill: makeBehaviorCounts({
      incorrectToCorrect: 5,
      correctToIncorrect: 2,
      incorrectToIncorrect: 4,
    }),
    exam: makeBehaviorCounts({
      incorrectToCorrect: 3,
      correctToIncorrect: 1,
      incorrectToIncorrect: 2,
    }),
  },
  flagged: {
    rushedWrong: { drill: 2, exam: 3 },
    stuck: { drill: 4, exam: 1 },
  },
  answered: { drill: 30, exam: 40 },
  lastFive: {
    modules: 12,
    reached: 8,
    answeredInLastFive: 15,
    questions: 200,
  },
  modules: [],
  thinBelow: 10,
};

describe('HabitsCard', () => {
  it('calculates and renders answer changes summed over drill and exam with N', async () => {
    await show(<HabitsCard habits={mockHabitsSufficient} />);

    // Helped: drill 5 + exam 3 = 8
    // Hurt: drill 2 + exam 1 = 3
    // Neutral: drill 4 + exam 2 = 6
    // N: 8 + 3 + 6 = 17 (>= 10, so no thin data tag for changes)
    expect(container.textContent).toContain('Answer changes');
    expect(container.textContent).toContain('Helped');
    expect(container.textContent).toContain('8');
    expect(container.textContent).toContain('wrong to right');
    expect(container.textContent).toContain('Hurt');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('right to wrong');
    expect(container.textContent).toContain('Neutral');
    expect(container.textContent).toContain('6');
    expect(container.textContent).toContain('wrong to wrong');
    expect(container.textContent).toContain('N = 17');
  });

  it('renders rushed vs stuck with plain definitions and N', async () => {
    await show(<HabitsCard habits={mockHabitsSufficient} />);

    // rushedWrong: drill 2 + exam 3 = 5
    // stuck: drill 4 + exam 1 = 5
    // totalAnswered: drill 30 + exam 40 = 70 (N = 70)
    expect(container.textContent).toContain('Rushed vs stuck');
    expect(container.textContent).toContain('5 of 70 answered');
    expect(container.textContent).toContain('wrong and much faster than your usual time');
    expect(container.textContent).toContain('much slower than your usual time');
    expect(container.textContent).toContain('N = 70');
  });

  it('renders last five minutes summary with N = modules', async () => {
    await show(<HabitsCard habits={mockHabitsSufficient} />);

    expect(container.textContent).toContain('Last five minutes');
    expect(container.textContent).toContain(
      '15 questions answered in the last five minutes over 8 reached modules',
    );
    expect(container.textContent).toContain('N = 12');
  });

  it('shows "No module reached the five-minute alert yet." when reached is 0', async () => {
    const zeroReachedHabits: HabitsSection = {
      ...mockHabitsSufficient,
      lastFive: {
        modules: 5,
        reached: 0,
        answeredInLastFive: 0,
        questions: 50,
      },
    };

    await show(<HabitsCard habits={zeroReachedHabits} />);

    expect(container.textContent).toContain('No module reached the five-minute alert yet.');
  });

  it('displays thin data tag when N < thinBelow for each block', async () => {
    const thinHabits: HabitsSection = {
      behavior: {
        drill: makeBehaviorCounts({
          incorrectToCorrect: 1,
          correctToIncorrect: 0,
          incorrectToIncorrect: 0,
        }),
        exam: makeBehaviorCounts({
          incorrectToCorrect: 0,
          correctToIncorrect: 1,
          incorrectToIncorrect: 0,
        }),
      },
      flagged: {
        rushedWrong: { drill: 0, exam: 1 },
        stuck: { drill: 1, exam: 0 },
      },
      answered: { drill: 2, exam: 3 }, // total = 5 < 10
      lastFive: {
        modules: 3, // 3 < 10
        reached: 1,
        answeredInLastFive: 2,
        questions: 30,
      },
      modules: [],
      thinBelow: 10,
    };

    await show(<HabitsCard habits={thinHabits} />);

    // N_changes = 1 + 1 + 0 = 2 < 10 -> thin data
    // N_answered = 5 < 10 -> thin data
    // N_modules = 3 < 10 -> thin data
    const thinTags = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.trim() === 'thin data',
    );
    expect(thinTags.length).toBe(3);
  });
});
