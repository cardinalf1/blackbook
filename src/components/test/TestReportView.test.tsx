import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syntheticQuestions } from '../../services/__fixtures__/synthetic';
import type { Question } from '../../types/sat';
import type { SessionReport } from '../../types/session';
import type { TestReport } from '../../types/test';
import { TestReportView } from './TestReportView';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function getSynthetic(index: number): Question {
  const q = syntheticQuestions[index];
  if (!q) {
    throw new Error(`Synthetic question not found at index ${index}`);
  }
  return q;
}

describe('TestReportView', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const qRw1 = getSynthetic(0); // rw MCQ, correct 'C'
  const qRw2 = getSynthetic(1); // rw MCQ, correct 'B'
  const qMath1 = getSynthetic(12); // math SPR, accepted ['1/4', '.25', '0.25']
  const qMath2 = getSynthetic(13); // math SPR, accepted ['-3']

  function buildMockSessionReport(items: Array<{ question: Question; response: string | null; correct: boolean }>): SessionReport {
    const correctCount = items.filter((i) => i.correct).length;
    return {
      sessionId: 'session-synthetic',
      mode: 'exam',
      startedAt: 1700000000000,
      finishedAt: 1700001800000,
      score: { correct: correctCount, total: items.length },
      totalActiveMs: 600000,
      byDomain: [
        {
          code: items[0]?.question.domainCode ?? 'CAS',
          label: items[0]?.question.domain ?? 'Craft and Structure',
          correct: correctCount,
          total: items.length,
          activeMs: 600000,
        },
      ],
      bySkill: [
        {
          code: items[0]?.question.skillCode ?? 'CAS.A.',
          label: items[0]?.question.skill ?? 'Words in Context',
          correct: correctCount,
          total: items.length,
          activeMs: 600000,
        },
      ],
      items: items.map((item, idx) => ({
        index: idx,
        questionId: item.question.id,
        displayId: item.question.displayId,
        section: item.question.section,
        domain: item.question.domain,
        skill: item.question.skill,
        difficulty: item.question.difficulty,
        response: item.response,
        correct: item.correct,
        correctAnswer: item.question.answer.kind === 'mcq' ? item.question.answer.correct : item.question.answer.accepted.join(', '),
        activeMs: 120000,
        firstVisitMs: 120000,
        flagged: !item.correct,
        changes: 0,
        confidence: null,
        question: item.question,
      })),
    };
  }

  function buildSyntheticFullReport(options?: { paused?: boolean; mathCapped?: boolean }): TestReport {
    const isPaused = options?.paused ?? true;
    const isMathCapped = options?.mathCapped ?? true;

    const rwReportM1 = buildMockSessionReport([
      { question: qRw1, response: 'C', correct: true },
      { question: qRw2, response: 'A', correct: false },
    ]);
    const rwReportM2 = buildMockSessionReport([
      { question: qRw1, response: 'C', correct: true },
    ]);

    const mathReportM1 = buildMockSessionReport([
      { question: qMath1, response: '1/4', correct: true },
      { question: qMath2, response: '5', correct: false },
    ]);
    const mathReportM2 = buildMockSessionReport([
      { question: qMath2, response: '-3', correct: true },
    ]);

    return {
      testId: 'test-report-full-1',
      containsRepeats: false,
      kind: 'full',
      startedAt: 1700000000000,
      finishedAt: 1700007200000,
      paused: isPaused,
      break: null,
      sections: [
        {
          section: 'rw',
          routing: {
            section: 'rw',
            route: 'harder',
            weightedFraction: 0.8,
            threshold: 0.65,
            correct: 2,
            total: 2,
            configVersion: 1,
            at: 1700001800000,
          },
          estimate: {
            section: 'rw',
            route: 'harder',
            weightedFraction: 0.8,
            low: 600,
            mid: 640,
            high: 680,
            capped: false,
            answered: 3,
            total: 3,
          },
          byDomain: [
            {
              code: 'CAS',
              label: 'Craft and Structure',
              correct: 2,
              total: 3,
              activeMs: 360000,
            },
          ],
          bySkill: [
            {
              code: 'CAS.A.',
              label: 'Words in Context',
              correct: 2,
              total: 2,
              activeMs: 240000,
            },
            {
              code: 'CAS.B.',
              label: 'Text Structure and Purpose',
              correct: 0,
              total: 1,
              activeMs: 120000,
            },
          ],
          modules: [
            {
              key: 'rw1',
              section: 'rw',
              moduleNumber: 1,
              tier: 'routing',
              title: 'Section 1, Module 1: Reading and Writing',
              correct: 1,
              total: 2,
              timeUsedMs: 1500000,
              timeLimitMs: 1920000,
              timeLeftMs: 420000,
              submittedBy: 'user',
              pauses: [],
              report: rwReportM1,
            },
            {
              key: 'rw2',
              section: 'rw',
              moduleNumber: 2,
              tier: 'harder',
              title: 'Section 1, Module 2: Reading and Writing',
              correct: 1,
              total: 1,
              timeUsedMs: 900000,
              timeLimitMs: 1920000,
              timeLeftMs: 1020000,
              submittedBy: 'user',
              pauses: [],
              report: rwReportM2,
            },
          ],
        },
        {
          section: 'math',
          routing: {
            section: 'math',
            route: 'easier',
            weightedFraction: 0.4,
            threshold: 0.65,
            correct: 1,
            total: 2,
            configVersion: 1,
            at: 1700005400000,
          },
          estimate: {
            section: 'math',
            route: 'easier',
            weightedFraction: 0.4,
            low: 480,
            mid: 520,
            high: 560,
            capped: isMathCapped,
            answered: 3,
            total: 3,
          },
          byDomain: [
            {
              code: 'H',
              label: 'Algebra',
              correct: 2,
              total: 3,
              activeMs: 300000,
            },
          ],
          bySkill: [
            {
              code: 'H.A.',
              label: 'Linear equations in one variable',
              correct: 2,
              total: 3,
              activeMs: 300000,
            },
          ],
          modules: [
            {
              key: 'math1',
              section: 'math',
              moduleNumber: 1,
              tier: 'routing',
              title: 'Section 2, Module 1: Math',
              correct: 1,
              total: 2,
              timeUsedMs: 2100000,
              timeLimitMs: 2100000,
              timeLeftMs: 0,
              submittedBy: 'timer',
              pauses: [
                {
                  at: 1700003000000,
                  reason: 'Bathroom break',
                  resumedAt: 1700003060000,
                },
              ],
              report: mathReportM1,
            },
            {
              key: 'math2',
              section: 'math',
              moduleNumber: 2,
              tier: 'easier',
              title: 'Section 2, Module 2: Math',
              correct: 1,
              total: 1,
              timeUsedMs: 1200000,
              timeLimitMs: 2100000,
              timeLeftMs: 900000,
              submittedBy: 'user',
              pauses: [],
              report: mathReportM2,
            },
          ],
        },
      ],
      estimate: {
        sections: [
          {
            section: 'rw',
            route: 'harder',
            weightedFraction: 0.8,
            low: 600,
            mid: 640,
            high: 680,
            capped: false,
            answered: 3,
            total: 3,
          },
          {
            section: 'math',
            route: 'easier',
            weightedFraction: 0.4,
            low: 480,
            mid: 520,
            high: 560,
            capped: isMathCapped,
            answered: 3,
            total: 3,
          },
        ],
        total: {
          low: 1080,
          mid: 1160,
          high: 1240,
        },
        configVersion: 1,
      },
    };
  }

  function buildSyntheticSectionReport(kind: 'rw' | 'math'): TestReport {
    const isRw = kind === 'rw';
    const q1 = isRw ? qRw1 : qMath1;
    const q2 = isRw ? qRw2 : qMath2;
    const secReport = buildMockSessionReport([
      { question: q1, response: isRw ? 'C' : '1/4', correct: true },
      { question: q2, response: 'Z', correct: false },
    ]);

    return {
      testId: `test-report-section-${kind}`,
      containsRepeats: false,
      kind,
      startedAt: 1700000000000,
      finishedAt: 1700003600000,
      paused: false,
      break: null,
      sections: [
        {
          section: kind,
          routing: {
            section: kind,
            route: 'harder',
            weightedFraction: 0.8,
            threshold: 0.65,
            correct: 2,
            total: 2,
            configVersion: 1,
            at: 1700001800000,
          },
          estimate: {
            section: kind,
            route: 'harder',
            weightedFraction: 0.8,
            low: 590,
            mid: 630,
            high: 670,
            capped: false,
            answered: 2,
            total: 2,
          },
          byDomain: secReport.byDomain,
          bySkill: secReport.bySkill,
          modules: [
            {
              key: isRw ? 'rw1' : 'math1',
              section: kind,
              moduleNumber: 1,
              tier: 'routing',
              title: `Module 1: ${isRw ? 'Reading and Writing' : 'Math'}`,
              correct: 1,
              total: 2,
              timeUsedMs: 1200000,
              timeLimitMs: 1920000,
              timeLeftMs: 720000,
              submittedBy: 'user',
              pauses: [],
              report: secReport,
            },
          ],
        },
      ],
      estimate: {
        sections: [
          {
            section: kind,
            route: 'harder',
            weightedFraction: 0.8,
            low: 590,
            mid: 630,
            high: 670,
            capped: false,
            answered: 2,
            total: 2,
          },
        ],
        total: null,
        configVersion: 1,
      },
    };
  }

  it('renders range text and estimate label, and never shows a lone exact score', async () => {
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    const text = container.textContent ?? '';

    // Estimate label
    expect(text).toContain('Estimated range, an approximation');

    // Section ranges
    expect(text).toContain('Reading and Writing: 600 to 680');
    expect(text).toContain('midpoint about 640');
    expect(text).toContain('Math: 480 to 560');
    expect(text).toContain('midpoint about 520');

    // Total range
    expect(text).toContain('Total: 1080 to 1240');
    expect(text).toContain('midpoint about 1160');

    // Model explanation and version
    expect(text).toContain('How this is calculated:');
    expect(text).toContain('Estimate model v1');

    // Rule 5: No lone exact score presented as an official or single score
    expect(text).not.toMatch(/\b(?:Score|Estimated score|Your score):\s*\d{3,4}\b/i);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders routing text for both routes', async () => {
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    const text = container.textContent ?? '';
    // Assert routing text for both routes
    expect(text).toContain('Routed to the harder Module 2');
    expect(text).toContain('Routed to the easier Module 2');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders capped note when capped is true and omits it when capped is false', async () => {
    const cappedReport = buildSyntheticFullReport({ mathCapped: true });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={cappedReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain(
      'The easier second module may limit the top of your range; the exact effect is not published.',
    );

    // Uncapped report
    const uncappedReport = buildSyntheticFullReport({ mathCapped: false });
    await act(async () => {
      root.render(
        <TestReportView
          report={uncappedReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain(
      'The easier second module may limit the top of your range; the exact effect is not published.',
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders paused note when test was paused and omits it when unpaused', async () => {
    const pausedReport = buildSyntheticFullReport({ paused: true });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={pausedReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('This test included an emergency pause.');

    const unpausedReport = buildSyntheticFullReport({ paused: false });
    await act(async () => {
      root.render(
        <TestReportView
          report={unpausedReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).not.toContain('This test included an emergency pause.');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders total range only for full test and omits total range for single section reports', async () => {
    const root = createRoot(container);

    // Full test: Total is present
    const fullReport = buildSyntheticFullReport();
    await act(async () => {
      root.render(
        <TestReportView
          report={fullReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Full test report');
    expect(container.textContent).toContain('Total: 1080 to 1240');

    // RW section report: Total is NOT present
    const rwReport = buildSyntheticSectionReport('rw');
    await act(async () => {
      root.render(
        <TestReportView
          report={rwReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Reading and Writing section report');
    expect(container.textContent).not.toContain('Total:');

    // Math section report: Total is NOT present
    const mathReport = buildSyntheticSectionReport('math');
    await act(async () => {
      root.render(
        <TestReportView
          report={mathReport}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Math section report');
    expect(container.textContent).not.toContain('Total:');

    await act(async () => {
      root.unmount();
    });
  });

  it('missed item expands, shows rationale, and calls onItemToggle', async () => {
    const onItemToggle = vi.fn();
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={onItemToggle}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    // Verify missed badge is present
    expect(container.textContent).toContain('Missed');

    // Find the toggle button for missed question qRw2
    const buttons = Array.from(container.querySelectorAll('button'));
    const toggleButtons = buttons.filter((b) => b.textContent?.includes('Show explanation'));
    expect(toggleButtons.length).toBeGreaterThan(0);

    // Click the toggle button to expand
    await act(async () => {
      toggleButtons[1]?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(qRw2.id, true);
    expect(container.textContent).toContain('Explanation');
    expect(container.textContent).toContain(
      'Choice B is correct because Text 2 qualifies the claim in Text 1 by highlighting limitations regarding larger wildlife.',
    );

    // Click again to collapse
    const hideButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hide explanation'),
    );
    expect(hideButton).toBeDefined();

    await act(async () => {
      hideButton?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(qRw2.id, false);

    await act(async () => {
      root.unmount();
    });
  });

  it('unmount with open item cleans up by calling onItemToggle(id, false)', async () => {
    const onItemToggle = vi.fn();
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={onItemToggle}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    const toggleButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Show explanation'),
    );
    expect(toggleButtons.length).toBeGreaterThan(0);

    await act(async () => {
      toggleButtons[0]?.click();
    });

    expect(onItemToggle).toHaveBeenCalledWith(qRw1.id, true);
    onItemToggle.mockClear();

    await act(async () => {
      root.unmount();
    });

    expect(onItemToggle).toHaveBeenCalledWith(qRw1.id, false);
  });

  it('handles navigation button clicks for onBack and onMySkills', async () => {
    const onBack = vi.fn();
    const onMySkills = vi.fn();
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={vi.fn()}
          onBack={onBack}
          onMySkills={onMySkills}
        />,
      );
    });

    const backButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Back to home',
    );
    expect(backButtons.length).toBeGreaterThan(0);
    await act(async () => {
      backButtons[0]?.click();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const skillsButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'My skills',
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

  it('renders submitted by timer badge and pause details', async () => {
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Submitted by timer');
    expect(container.textContent).toContain('Paused: this is not a clean timed run.');
    expect(container.textContent).toContain('Bathroom break');
    expect(container.textContent).toContain('1:00');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders PacingSection in module reports', async () => {
    const report = buildSyntheticFullReport();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestReportView
          report={report}
          onItemToggle={vi.fn()}
          onBack={vi.fn()}
          onMySkills={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Pacing');

    await act(async () => {
      root.unmount();
    });
  });
});
