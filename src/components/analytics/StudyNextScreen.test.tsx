import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissesDrill, StudyRecommendation, TopSkillsDrill } from '../../types/analytics';
import type { DrillConfig } from '../../types/drill';
import { StudyNextScreen } from './StudyNextScreen';

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

const sampleRecLowN: StudyRecommendation = {
  skillCode: 'rw-inf',
  skill: 'Inferences',
  domain: 'Information and Ideas',
  section: 'rw',
  priority: 0.85,
  attempts: 4,
  correct: 1,
  unseenLive: 12,
  bankLive: 20,
  reasons: ['few attempts so far (4)', '12 unseen questions left'],
};

const sampleRecHighN: StudyRecommendation = {
  skillCode: 'math-lin',
  skill: 'Linear equations in one variable',
  domain: 'Algebra',
  section: 'math',
  priority: 0.62,
  attempts: 25,
  correct: 15,
  unseenLive: 5,
  bankLive: 30,
  reasons: ['60% over 25 attempts, not yet proven strong'],
};

const sampleTopDrillConfig: DrillConfig = {
  section: 'rw',
  domainCode: 'all',
  skillCodes: ['rw-inf'],
  difficulties: [],
  count: 10,
  liveOnly: true,
};

const sampleTopDrills: TopSkillsDrill[] = [
  {
    section: 'rw',
    skills: [sampleRecLowN],
    config: sampleTopDrillConfig,
  },
];

const sampleMissDrillConfig: DrillConfig = {
  section: 'rw',
  domainCode: 'all',
  skillCodes: [],
  difficulties: [],
  count: 15,
  liveOnly: false,
  questionIds: ['q1', 'q2', 'q3'],
};

const sampleMissDrills: MissesDrill[] = [
  {
    section: 'rw',
    available: 3,
    config: sampleMissDrillConfig,
  },
];

describe('StudyNextScreen', () => {
  it('shows the heading and the method note', async () => {
    const note = 'Skills are ranked by Wilson lower bound (z = 1.2816).';
    await show(
      <StudyNextScreen
        recommendations={[]}
        methodNote={note}
        topDrills={[]}
        missDrills={[]}
        onLaunch={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Study next');
    expect(container.textContent).toContain(note);
  });

  it('renders ranked recommendations in the given order with all required details', async () => {
    await show(
      <StudyNextScreen
        recommendations={[sampleRecLowN, sampleRecHighN]}
        methodNote="Method explanation"
        topDrills={[]}
        missDrills={[]}
        onLaunch={vi.fn()}
      />,
    );

    // List order follows given order
    const text = container.textContent ?? '';
    const posInferences = text.indexOf('Inferences');
    const posLinear = text.indexOf('Linear equations in one variable');
    expect(posInferences).toBeGreaterThanOrEqual(0);
    expect(posLinear).toBeGreaterThanOrEqual(0);
    expect(posInferences).toBeLessThan(posLinear);

    // Position numbers
    expect(text).toContain('#1');
    expect(text).toContain('#2');

    // Section and domain
    expect(text).toContain('Reading and Writing');
    expect(text).toContain('Information and Ideas');
    expect(text).toContain('Math');
    expect(text).toContain('Algebra');

    // Priority formatted with two decimals
    expect(text).toContain('priority 0.85');
    expect(text).toContain('priority 0.62');

    // Correct of attempts and live questions unseen
    expect(text).toContain('1 of 4');
    expect(text).toContain('12 of 20 live questions unseen');
    expect(text).toContain('15 of 25');
    expect(text).toContain('5 of 30 live questions unseen');

    // Reasons text chips
    expect(text).toContain('few attempts so far (4)');
    expect(text).toContain('12 unseen questions left');
    expect(text).toContain('60% over 25 attempts, not yet proven strong');
  });

  it('shows "low N" tag for a small sample and not for a large one', async () => {
    // Render only low N sample (4 attempts < 10)
    await show(
      <StudyNextScreen
        recommendations={[sampleRecLowN]}
        methodNote="Note"
        topDrills={[]}
        missDrills={[]}
        onLaunch={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('4 answers');
    expect(container.textContent).toContain('low N');

    // Render only high N sample (25 attempts >= 10)
    await show(
      <StudyNextScreen
        recommendations={[sampleRecHighN]}
        methodNote="Note"
        topDrills={[]}
        missDrills={[]}
        onLaunch={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('25 answers');
    expect(container.textContent).not.toContain('low N');
  });

  it('calls onLaunch with the exact config object when clicking launch buttons', async () => {
    const onLaunch = vi.fn();
    await show(
      <StudyNextScreen
        recommendations={[sampleRecLowN]}
        methodNote="Note"
        topDrills={sampleTopDrills}
        missDrills={sampleMissDrills}
        onLaunch={onLaunch}
      />,
    );

    // Verify small text under topDrills button
    expect(container.textContent).toContain('Drill top skills in Reading and Writing');
    expect(container.textContent).toContain('Inferences');
    expect(container.textContent).toContain('prefers questions you have not answered yet');

    // Verify text under missDrills button
    expect(container.textContent).toContain('Review my misses in Reading and Writing');
    expect(container.textContent).toContain('3 missed questions, oldest miss first (up to 15 per drill)');

    // Click top drill button
    const buttons = Array.from(container.querySelectorAll('button'));
    const topButton = buttons.find((b) => b.textContent?.includes('Drill top skills in Reading and Writing'));
    expect(topButton).toBeDefined();

    await act(async () => {
      topButton?.click();
    });
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenLastCalledWith(sampleTopDrillConfig);

    // Click miss review button
    const missButton = buttons.find((b) => b.textContent?.includes('Review my misses in Reading and Writing'));
    expect(missButton).toBeDefined();

    await act(async () => {
      missButton?.click();
    });
    expect(onLaunch).toHaveBeenCalledTimes(2);
    expect(onLaunch).toHaveBeenLastCalledWith(sampleMissDrillConfig);
  });

  it('renders empty states for no recommendations and no misses', async () => {
    await show(
      <StudyNextScreen
        recommendations={[]}
        methodNote="Note"
        topDrills={[]}
        missDrills={[]}
        onLaunch={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Nothing to recommend yet. Finish a drill or an exam module first.');
    expect(container.textContent).toContain('No missed questions to review.');

    // Ensure no drill buttons exist
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });
});
