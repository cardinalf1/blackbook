import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { ExamPause } from '../../types/exam';
import type { Question } from '../../types/sat';
import type { SessionReport } from '../../types/session';
import { ExamResults } from './ExamResults';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function getSynthetic(index: number): Question {
  const q = syntheticQuestions[index];
  if (!q) {
    throw new Error(`Synthetic question not found at index ${index}`);
  }
  return q;
}

describe('ExamResults', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const q1 = getSynthetic(0);
  const q2 = getSynthetic(1);

  const mockReport: SessionReport = {
    sessionId: 'session-exam-1',
    mode: 'exam',
    startedAt: 1700000000000,
    finishedAt: 1700001800000,
    score: { correct: 3, total: 5 },
    totalActiveMs: 1200000,
    byDomain: [
      {
        code: 'CAS',
        label: 'Craft and Structure',
        correct: 2,
        total: 3,
        activeMs: 600000,
      },
    ],
    bySkill: [
      {
        code: 'CAS.A.',
        label: 'Words in Context',
        correct: 1,
        total: 1,
        activeMs: 250000,
      },
    ],
    items: [
      {
        index: 0,
        questionId: q1.id,
        displayId: q1.displayId,
        section: q1.section,
        domain: q1.domain,
        skill: q1.skill,
        difficulty: q1.difficulty,
        response: 'C',
        correct: true,
        correctAnswer: 'C',
        activeMs: 250000,
        firstVisitMs: 250000,
        flagged: false,
        changes: 0,
        confidence: null,
        question: q1,
      },
      {
        index: 1,
        questionId: q2.id,
        displayId: q2.displayId,
        section: q2.section,
        domain: q2.domain,
        skill: q2.skill,
        difficulty: q2.difficulty,
        response: 'A',
        correct: false,
        correctAnswer: 'B',
        activeMs: 350000,
        firstVisitMs: 100000,
        flagged: true,
        changes: 1,
        confidence: null,
        question: q2,
      },
    ],
  };

  it('renders timer note only when submittedBy is "timer"', async () => {
    const root = createRoot(container);

    // First: submittedBy is 'timer'
    await act(async () => {
      root.render(
        <ExamResults
          title="Section 1, Module 1: Reading and Writing"
          report={mockReport}
          submittedBy="timer"
          pauses={[]}
          timeUsedMs={1920000} // 32:00
          timeLimitMs={1920000} // 32:00
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain(
      'Time ran out. The module was submitted automatically.',
    );

    // Second: submittedBy is 'user'
    await act(async () => {
      root.render(
        <ExamResults
          title="Section 1, Module 1: Reading and Writing"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1500000}
          timeLimitMs={1920000}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain(
      'Time ran out. The module was submitted automatically.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders paused box only when pauses are present, listing reasons and durations', async () => {
    const root = createRoot(container);

    const pauses: ExamPause[] = [
      {
        at: 1700000500000,
        reason: 'Restroom break',
        resumedAt: 1700000560000, // 60s -> 1:00
      },
      {
        at: 1700001000000,
        reason: 'Emergency interruption',
        resumedAt: null, // not resumed
      },
    ];

    await act(async () => {
      root.render(
        <ExamResults
          title="Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={pauses}
          timeUsedMs={1200000}
          timeLimitMs={1920000}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Paused: this is not a clean timed run.');
    expect(container.textContent).toContain('Restroom break');
    expect(container.textContent).toContain('1:00');
    expect(container.textContent).toContain('Emergency interruption');
    expect(container.textContent).toContain('not resumed');

    // Without pauses
    await act(async () => {
      root.render(
        <ExamResults
          title="Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1200000}
          timeLimitMs={1920000}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain('Paused: this is not a clean timed run.');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders time used text and raw score note', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamResults
          title="Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1200000} // 20:00
          timeLimitMs={1920000} // 32:00
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Time used: 20:00 of 32:00');
    expect(container.textContent).toContain(
      'Raw score only. Scaled scores and score ranges come later.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders DrillReport content such as score text and domain breakdowns', async () => {
    const onItemToggle = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamResults
          title="Reading and Writing Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1200000}
          timeLimitMs={1920000}
          onItemToggle={onItemToggle}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    // Score from mockReport: 3 / 5 (60%)
    expect(container.textContent).toContain('3 / 5');
    expect(container.textContent).toContain('(60%)');
    expect(container.textContent).toContain('Craft and Structure');
    expect(container.textContent).toContain('Words in Context');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not display any 200-800 score estimates and the word "estimate" does not appear', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamResults
          title="Reading and Writing Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1200000}
          timeLimitMs={1920000}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    const fullText = container.textContent ?? '';
    expect(fullText.toLowerCase()).not.toContain('estimate');
    expect(fullText).not.toMatch(/\b[2-8]\d0\b.*score/i);

    await act(async () => {
      root.unmount();
    });
  });

  it('handles Done and My skills button clicks', async () => {
    const onBack = vi.fn();
    const onMySkills = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ExamResults
          title="Reading and Writing Module 1"
          report={mockReport}
          submittedBy="user"
          pauses={[]}
          timeUsedMs={1200000}
          timeLimitMs={1920000}
          onItemToggle={vi.fn()}
          onBack={onBack}
          onMySkills={onMySkills}
        />,
      );
    });

    const doneButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim() === 'Done',
    );
    expect(doneButtons.length).toBeGreaterThan(0);
    await act(async () => {
      doneButtons[0]?.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const skillsButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim() === 'My skills',
    );
    expect(skillsButtons.length).toBeGreaterThan(0);
    await act(async () => {
      skillsButtons[0]?.click();
    });
    expect(onMySkills).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
