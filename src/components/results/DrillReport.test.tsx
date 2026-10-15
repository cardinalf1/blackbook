import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { Question } from '../../types/sat';
import type { SessionReport } from '../../types/session';
import { DrillReport } from './DrillReport';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function getSynthetic(index: number): Question {
  const q = syntheticQuestions[index];
  if (!q) {
    throw new Error(`Synthetic question not found at index ${index}`);
  }
  return q;
}

describe('DrillReport', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const q1 = getSynthetic(0); // mcq, correct 'C'
  const q2 = getSynthetic(1); // mcq, correct 'B'
  const qSpr = getSynthetic(12); // spr, accepted ['1/4', '.25', '0.25']

  const mockReport: SessionReport = {
    sessionId: 'session-123',
    mode: 'drill',
    startedAt: 1700000000000,
    finishedAt: 1700000060000,
    score: { correct: 1, total: 4 },
    totalActiveMs: 60000,
    byDomain: [
      {
        code: 'CAS',
        label: 'Craft and Structure',
        correct: 1,
        total: 2,
        activeMs: 30000,
      },
    ],
    bySkill: [
      {
        code: 'CAS.A.',
        label: 'Words in Context',
        correct: 1,
        total: 1,
        activeMs: 15000,
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
        activeMs: 15000,
        firstVisitMs: 15000, // same as activeMs
        flagged: false,
        changes: 0,
        confidence: 'sure',
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
        activeMs: 20000,
        firstVisitMs: 8000, // different from activeMs
        flagged: true,
        changes: 2,
        confidence: 'guess',
        question: q2,
      },
      {
        index: 2,
        questionId: qSpr.id,
        displayId: qSpr.displayId,
        section: qSpr.section,
        domain: qSpr.domain,
        skill: qSpr.skill,
        difficulty: qSpr.difficulty,
        response: null,
        correct: false,
        correctAnswer: '1/4, .25, 0.25',
        activeMs: 12000,
        firstVisitMs: 12000,
        flagged: false,
        changes: 0,
        confidence: null,
        question: qSpr,
      },
      {
        index: 3,
        questionId: 'orphaned-q',
        displayId: 'xx999999',
        section: 'rw',
        domain: 'Information and Ideas',
        skill: 'Inferences',
        difficulty: 'H',
        response: 'B',
        correct: false,
        correctAnswer: 'A',
        activeMs: 13000,
        firstVisitMs: null,
        flagged: true,
        changes: 1,
        confidence: 'unsure',
        question: null,
      },
    ],
  };

  it('renders score, percentage, breakdown and handles navigation buttons', async () => {
    const onBack = vi.fn();
    const onMySkills = vi.fn();
    const onItemToggle = vi.fn();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={onItemToggle}
          onBack={onBack}
          backLabel="Back to past drills"
          onMySkills={onMySkills}
        />,
      );
    });

    expect(container.textContent).toContain('Drill report');
    expect(container.textContent).toContain('1 / 4');
    expect(container.textContent).toContain('(25%)');
    expect(container.textContent).toContain('Craft and Structure');
    expect(container.textContent).toContain('Words in Context');

    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back to past drills'),
    );
    expect(backBtn).toBeDefined();
    await act(async () => {
      backBtn?.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const skillsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('My skills'),
    );
    expect(skillsBtn).toBeDefined();
    await act(async () => {
      skillsBtn?.click();
    });
    expect(onMySkills).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('filters items: Missed filter hides correct rows', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    // Initially all 4 items present
    expect(container.textContent).toContain(`#${q1.displayId}`);
    expect(container.textContent).toContain(`#${q2.displayId}`);

    const missedBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Missed',
    );
    expect(missedBtn).toBeDefined();

    await act(async () => {
      missedBtn?.click();
    });

    // Missed filter hides q1 (correct) and shows q2, qSpr, orphaned-q
    expect(container.textContent).not.toContain(`#${q1.displayId}`);
    expect(container.textContent).toContain(`#${q2.displayId}`);
    expect(container.textContent).toContain(`#${qSpr.displayId}`);
    expect(container.textContent).toContain('#xx999999');

    // Switch to Flagged
    const flaggedBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Flagged',
    );
    await act(async () => {
      flaggedBtn?.click();
    });

    expect(container.textContent).not.toContain(`#${q1.displayId}`);
    expect(container.textContent).not.toContain(`#${qSpr.displayId}`);
    expect(container.textContent).toContain(`#${q2.displayId}`);
    expect(container.textContent).toContain('#xx999999');

    await act(async () => {
      root.unmount();
    });
  });

  it('expanding calls onItemToggle(id, true) and shows Explanation, collapsing calls onItemToggle(id, false)', async () => {
    const onItemToggle = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={onItemToggle}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    const toggleButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Show explanation'),
    );
    expect(toggleButtons.length).toBe(4);

    // Expand the first row (q1)
    await act(async () => {
      toggleButtons[0]?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(q1.id, true);
    expect(container.textContent).toContain('Explanation');
    expect(toggleButtons[0]?.textContent).toContain('Hide explanation');

    // Collapse the first row
    await act(async () => {
      toggleButtons[0]?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(q1.id, false);
    expect(toggleButtons[0]?.textContent).toContain('Show explanation');

    await act(async () => {
      root.unmount();
    });
  });

  it('unmount with an open row calls onItemToggle(id, false)', async () => {
    const onItemToggle = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={onItemToggle}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    const toggleButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Show explanation'),
    );

    // Open first and second rows
    await act(async () => {
      toggleButtons[0]?.click();
      toggleButtons[1]?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(q1.id, true);
    expect(onItemToggle).toHaveBeenCalledWith(q2.id, true);

    onItemToggle.mockClear();

    // Unmount
    await act(async () => {
      root.unmount();
    });

    expect(onItemToggle).toHaveBeenCalledWith(q1.id, false);
    expect(onItemToggle).toHaveBeenCalledWith(q2.id, false);
  });

  it('shows Unanswered badge for unanswered questions', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Unanswered');
    expect(container.textContent).toContain('first visit 0:08');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows the "no longer in your question bank" text when question is null', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    // Find the toggle button for the 4th item (index 3, orphaned-q)
    const toggleButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Show explanation'),
    );
    expect(toggleButtons.length).toBe(4);

    await act(async () => {
      toggleButtons[3]?.click();
    });

    expect(container.textContent).toContain('This question is no longer in your question bank.');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders SPR accepted answers when expanded', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DrillReport
          report={mockReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          backLabel="Done"
          onMySkills={vi.fn()}
        />,
      );
    });

    // Expand SPR item (index 2)
    const toggleButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Show explanation'),
    );

    await act(async () => {
      toggleButtons[2]?.click();
    });

    expect(container.textContent).toContain('Accepted answers:');
    expect(container.textContent).toContain('1/4, .25, 0.25');

    await act(async () => {
      root.unmount();
    });
  });
});
