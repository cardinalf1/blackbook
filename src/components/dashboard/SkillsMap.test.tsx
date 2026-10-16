import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../../types/dashboard';
import type { DrillConfig } from '../../types/drill';
import { SkillsMap } from './SkillsMap';

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

const mockDrillConfigMath: DrillConfig = {
  section: 'math',
  domainCode: 'all',
  skillCodes: ['math-alg-lin', 'math-alg-sys', 'math-alg-quad'],
  difficulties: [],
  count: 10,
  liveOnly: true,
};

const mockDrillConfigRw: DrillConfig = {
  section: 'rw',
  domainCode: 'all',
  skillCodes: ['rw-inf', 'rw-cmd-evid', 'rw-cent-idea'],
  difficulties: [],
  count: 10,
  liveOnly: true,
};

const mockSkillsData: DashboardData['skills'] = {
  domains: [
    {
      section: 'math',
      domainCode: 'algebra',
      domain: 'Algebra',
      officialWeight: 0.35,
      practiceShare: 0.22,
      timeMs: 120_000,
      attempts: 20,
      correct: 16,
      skills: [
        {
          skillCode: 'math-alg-lin',
          skill: 'Linear equations in one variable',
          attempts: 15,
          correct: 12,
          low: 0.65,
          high: 0.9,
          priority: 0.75,
          counts: {
            drill: { attempts: 10, correct: 8, timeMs: 60_000 },
            exam: { attempts: 5, correct: 4, timeMs: 30_000 },
          },
          unseenLive: 5,
          bankLive: 20,
        },
        {
          skillCode: 'math-alg-sys',
          skill: 'Linear equation systems',
          attempts: 0,
          correct: 0,
          low: 0,
          high: 0,
          priority: 0.9,
          counts: {
            drill: { attempts: 0, correct: 0, timeMs: 0 },
            exam: { attempts: 0, correct: 0, timeMs: 0 },
          },
          unseenLive: 15,
          bankLive: 15,
        },
      ],
    },
    {
      section: 'rw',
      domainCode: 'craft',
      domain: 'Craft and Structure',
      officialWeight: null,
      practiceShare: null,
      timeMs: 0,
      attempts: 0,
      correct: 0,
      skills: [],
    },
  ],
  methodNote: 'Skills are ranked by Wilson score lower bound approximation.',
  topDrills: [
    {
      section: 'math',
      skillCodes: ['math-alg-lin', 'math-alg-sys', 'math-alg-quad'],
      config: mockDrillConfigMath,
    },
    {
      section: 'rw',
      skillCodes: ['rw-inf', 'rw-cmd-evid', 'rw-cent-idea'],
      config: mockDrillConfigRw,
    },
  ],
};

describe('SkillsMap', () => {
  it('renders domain headers with official weight and practice time (including unknown)', async () => {
    await show(
      <SkillsMap
        skills={mockSkillsData}
        onSkill={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Algebra');
    expect(container.textContent).toContain('Official weight 35%');
    expect(container.textContent).toContain('Your practice time 22%');

    expect(container.textContent).toContain('Craft and Structure');
    expect(container.textContent).toContain('Official weight unknown');
    expect(container.textContent).toContain('Your practice time unknown');
  });

  it('renders interval and N for skills with attempts, and "not tried yet" for skills with 0 attempts', async () => {
    await show(
      <SkillsMap
        skills={mockSkillsData}
        onSkill={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    // Linear equations has 15 attempts, 12 correct
    expect(container.textContent).toContain('12 of 15');
    expect(container.textContent).toContain('N = 15');

    // Wilson interval rendered
    const intervals = container.querySelectorAll('[data-testid="wilson-interval"]');
    expect(intervals.length).toBe(1);
    expect(intervals[0]?.getAttribute('aria-label')).toContain('Wilson interval 65%–90%');

    // Linear equation systems has 0 attempts
    expect(container.textContent).toContain('not tried yet');
  });

  it('calls onSkill when clicking a skill name button', async () => {
    const onSkill = vi.fn();
    await show(
      <SkillsMap
        skills={mockSkillsData}
        onSkill={onSkill}
        onAction={vi.fn()}
      />,
    );

    const buttons = Array.from(container.querySelectorAll('button'));
    const skillButton = buttons.find((b) =>
      b.textContent?.includes('Linear equations in one variable'),
    );
    expect(skillButton).toBeDefined();

    await act(async () => {
      skillButton?.click();
    });

    expect(onSkill).toHaveBeenCalledTimes(1);
    expect(onSkill).toHaveBeenCalledWith('math-alg-lin');
  });

  it('renders methodNote and topDrills action buttons calling onAction', async () => {
    const onAction = vi.fn();
    await show(
      <SkillsMap
        skills={mockSkillsData}
        onSkill={vi.fn()}
        onAction={onAction}
      />,
    );

    expect(container.textContent).toContain(
      'Skills are ranked by Wilson score lower bound approximation.',
    );

    const buttons = Array.from(container.querySelectorAll('button'));
    const mathDrillButton = buttons.find((b) =>
      b.textContent?.includes('Drill top 3 Math skills'),
    );
    const rwDrillButton = buttons.find((b) =>
      b.textContent?.includes('Drill top 3 Reading and Writing skills'),
    );

    expect(mathDrillButton).toBeDefined();
    expect(rwDrillButton).toBeDefined();

    await act(async () => {
      mathDrillButton?.click();
    });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      kind: 'drill',
      label: 'Drill top 3 Math skills',
      config: mockDrillConfigMath,
    });

    await act(async () => {
      rwDrillButton?.click();
    });

    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith({
      kind: 'drill',
      label: 'Drill top 3 Reading and Writing skills',
      config: mockDrillConfigRw,
    });
  });

  it('renders empty message when domains list is empty', async () => {
    await show(
      <SkillsMap
        skills={{ domains: [], methodNote: 'Note', topDrills: [] }}
        onSkill={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('No skill data in this period.');
  });
});
