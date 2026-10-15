import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TimingSummary } from '../../types/analytics';
import { TimingScreen } from './TimingScreen';

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

const mockSummary: TimingSummary = {
  baselines: [
    {
      mode: 'drill',
      section: 'rw',
      difficulty: 'E',
      n: 25,
      medianMs: 40_000,
      rushMs: 15_000,
      stuckMs: 75_000,
      usable: true,
      timeMs: 1_000_000,
    },
    {
      mode: 'drill',
      section: 'math',
      difficulty: 'H',
      n: 6,
      medianMs: 80_000,
      rushMs: 30_000,
      stuckMs: 120_000,
      usable: false,
      timeMs: 480_000,
    },
    {
      mode: 'exam',
      section: 'math',
      difficulty: 'E',
      n: 30,
      medianMs: 50_000,
      rushMs: 20_000,
      stuckMs: 90_000,
      usable: true,
      timeMs: 1_500_000,
    },
  ],
  flaggedCounts: {
    rushedWrong: { drill: 2, exam: 1 },
    stuck: { drill: 4, exam: 3 },
  },
  flagged: [
    {
      questionId: 'q-1',
      sessionId: 'sess-1',
      mode: 'drill',
      section: 'rw',
      skillCode: 'INI',
      difficulty: 'E',
      flag: 'rushed_wrong',
      timeMs: 12_000,
      thresholdMs: 15_000,
      correct: false,
      at: 1_700_000_000_000,
    },
    {
      questionId: 'q-2',
      sessionId: 'sess-2',
      mode: 'exam',
      section: 'math',
      skillCode: 'LNE',
      difficulty: 'H',
      flag: 'stuck',
      timeMs: 130_000,
      thresholdMs: 120_000,
      correct: true,
      at: 1_700_000_100_000,
    },
  ],
  modules: [
    {
      sessionId: 'sess-mod-1',
      finishedAt: 1_700_000_000_000,
      section: 'rw',
      moduleNumber: 1,
      tier: 'routing',
      kind: 'full',
      timeLimitMs: 1_920_000,
      timeLeftMs: 180_000,
      submittedBy: 'user',
      paused: false,
      questions: 27,
      answered: 27,
      reachedFiveMinutes: true,
      answeredInLastFive: 4,
    },
    {
      sessionId: 'sess-mod-2',
      finishedAt: 1_700_000_200_000,
      section: 'math',
      moduleNumber: 2,
      tier: 'harder',
      kind: 'full',
      timeLimitMs: 2_100_000,
      timeLeftMs: 0,
      submittedBy: 'timer',
      paused: true,
      questions: 22,
      answered: 20,
      reachedFiveMinutes: false,
      answeredInLastFive: 0,
    },
  ],
};

describe('TimingScreen', () => {
  it('renders separate drill and exam sections, threshold explanation, and not enough data rows', async () => {
    await show(
      <TimingScreen
        summary={mockSummary}
        skillName={(code) => (code === 'INI' ? 'Inferences' : code === 'LNE' ? 'Linear equations' : code)}
      />,
    );

    // Baseline sections kept separate
    expect(container.textContent).toContain('Your timing baselines');
    expect(container.textContent).toContain('Drills');
    expect(container.textContent).toContain('Exam modules');

    // Threshold explanation line
    expect(container.textContent).toContain('Thresholds are percentiles (15th percentile for rushed, 90th percentile for stuck) of your own time');

    // Usable row displays thresholds
    expect(container.textContent).toContain('0:40');
    expect(container.textContent).toContain('0:15');
    expect(container.textContent).toContain('1:15');

    // Unusable row shows 'not enough data (N of MIN_BASELINE_ATTEMPTS needed)'
    expect(container.textContent).toContain('not enough data (6 of 20 needed)');

    // Flagged counts and exact behavior wording
    expect(container.textContent).toContain('answered fast and wrong');
    expect(container.textContent).toContain('took unusually long');
    expect(container.textContent).toContain('Inferences');
    expect(container.textContent).toContain('Linear equations');
    expect(container.textContent).toContain('right');
    expect(container.textContent).toContain('wrong');

    // Exam module pacing
    expect(container.textContent).toContain('Section 1, Module 1');
    expect(container.textContent).toContain('submitted by you');
    expect(container.textContent).toContain('answered 4 of 27 questions in the last five minutes');

    expect(container.textContent).toContain('Section 2, Module 2');
    expect(container.textContent).toContain('submitted by the timer');
    expect(container.textContent).toContain('paused');
    expect(container.textContent).toContain('ended before the five-minute alert');
  });

  it('renders empty states when no data is present', async () => {
    const emptySummary: TimingSummary = {
      baselines: [],
      flaggedCounts: {
        rushedWrong: { drill: 0, exam: 0 },
        stuck: { drill: 0, exam: 0 },
      },
      flagged: [],
      modules: [],
    };

    await show(<TimingScreen summary={emptySummary} skillName={(code) => code} />);
    expect(container.textContent).toContain('No baseline data yet for drills.');
    expect(container.textContent).toContain('No baseline data yet for exam modules.');
    expect(container.textContent).toContain('No flagged questions in this view.');
    expect(container.textContent).toContain('No exam modules in this view yet.');
  });
});
