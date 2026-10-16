import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { SessionReport } from '../../types/session';
import { PacingSection } from './PacingSection';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PacingSection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const q1 = syntheticQuestions[0]!;
  const q2 = syntheticQuestions[1]!;
  const q3 = syntheticQuestions[2]!;

  const createSyntheticReport = (mode: 'drill' | 'exam' = 'drill'): SessionReport => ({
    sessionId: 'test-session-pacing',
    mode,
    startedAt: 1700000000000,
    finishedAt: 1700000300000,
    score: { correct: 2, total: 3 },
    totalActiveMs: 300000,
    byDomain: [],
    bySkill: [],
    items: [
      {
        index: 0,
        questionId: q1.id,
        displayId: q1.displayId,
        section: 'rw',
        domain: q1.domain,
        skill: q1.skill,
        difficulty: q1.difficulty,
        response: 'C',
        correct: true,
        correctAnswer: 'C',
        activeMs: 40000, // under target (~71s)
        firstVisitMs: 40000,
        flagged: false,
        changes: 0,
        confidence: 'sure',
        question: q1,
      },
      {
        index: 1,
        questionId: q2.id,
        displayId: q2.displayId,
        section: 'rw',
        domain: q2.domain,
        skill: q2.skill,
        difficulty: q2.difficulty,
        response: 'A',
        correct: false,
        correctAnswer: 'B',
        activeMs: 160000, // over target (~71s * 1.25 = ~89s, 160s is ~2.2x)
        firstVisitMs: 80000,
        flagged: true,
        changes: 1,
        confidence: 'unsure',
        question: q2,
      },
      {
        index: 2,
        questionId: q3.id,
        displayId: q3.displayId,
        section: 'rw',
        domain: q3.domain,
        skill: q3.skill,
        difficulty: q3.difficulty,
        response: 'D',
        correct: true,
        correctAnswer: 'D',
        activeMs: 100000, // over target
        firstVisitMs: 100000,
        flagged: false,
        changes: 0,
        confidence: 'sure',
        question: q3,
      },
    ],
  });

  it('is collapsed by default and expands on click', async () => {
    const report = createSyntheticReport('drill');
    const root = createRoot(container);

    await act(async () => {
      root.render(<PacingSection report={report} section="rw" timeLimitMs={null} />);
    });

    const toggleButton = container.querySelector('button');
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).toContain('Show');
    // Content should not be visible when collapsed
    expect(container.textContent).not.toContain('Checkpoints');

    // Click to expand
    await act(async () => {
      toggleButton?.click();
    });

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Checkpoints');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders over-target and checkpoint text from a synthetic report', async () => {
    const report = createSyntheticReport('drill');
    const root = createRoot(container);

    await act(async () => {
      root.render(<PacingSection report={report} section="rw" timeLimitMs={null} />);
    });

    // Expand
    const toggleButton = container.querySelector('button')!;
    await act(async () => {
      toggleButton.click();
    });

    // Target per question (RW is ~71s)
    expect(container.textContent).toContain('71s');

    // Over target list: Question 2 (index 1) should be present
    expect(container.textContent).toContain('Over-target questions');
    expect(container.textContent).toContain(`Question 2`);
    expect(container.textContent).toContain(`#${q2.displayId}`);
    expect(container.textContent).toMatch(/\d+\.\d+x target/);

    // Checkpoint lines
    expect(container.textContent).toContain('At 25% of the time:');
    expect(container.textContent).toContain('At 50% of the time:');
    expect(container.textContent).toContain('At 75% of the time:');
    expect(container.textContent).toContain('done, pace expects');

    // Approximate warning should not appear for drill
    expect(container.textContent).not.toContain(
      'Exam modules let you jump around, so the checkpoint figures assume you went in order.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders approximate notice for exam session and last five minutes when time limit given', async () => {
    const report = createSyntheticReport('exam');
    const root = createRoot(container);

    // 32 minutes limit (RW module) = 1920000 ms
    await act(async () => {
      root.render(
        <PacingSection report={report} section="rw" timeLimitMs={1920000} />,
      );
    });

    const toggleButton = container.querySelector('button')!;
    await act(async () => {
      toggleButton.click();
    });

    // Approximate note
    expect(container.textContent).toContain(
      'Exam modules let you jump around, so the checkpoint figures assume you went in order.',
    );

    // Last five minutes section
    expect(container.textContent).toContain('Last five minutes:');

    await act(async () => {
      root.unmount();
    });
  });
});
