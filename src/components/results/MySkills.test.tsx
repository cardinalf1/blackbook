import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillStatRow } from '../../types/drill';
import { MySkills } from './MySkills';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/retry/load', () => ({
  loadRetryState: vi.fn().mockResolvedValue({
    queue: [],
    dueCount: 0,
    accuracy: { answered: 10, correct: 8 },
  }),
}));

describe('MySkills', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
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

  const sampleRow: SkillStatRow = {
    section: 'rw',
    domain: 'Craft and Structure',
    skillCode: 'CAS.A',
    skill: 'Words in Context',
    attempts: 12,
    correct: 9,
    accuracy: 0.75,
    avgTimeMs: 45000,
    lowData: false,
  };

  it('renders skill rows and retries accuracy line from props', async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <MySkills
          rows={[sampleRow]}
          unattributed={0}
          onBack={vi.fn()}
          retryAccuracy={{ answered: 5, correct: 3 }}
        />,
      );
    });

    expect(container.textContent).toContain('Words in Context');
    expect(container.textContent).toContain('75%');
    expect(container.textContent).toContain('Retries: 3 of 5 correct');
    expect(container.textContent).toContain('(separate from skill accuracy above)');
  });

  it('loads retry state asynchronously if retryAccuracy prop is omitted', async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <MySkills
          rows={[]}
          unattributed={0}
          onBack={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('No skill data available');
    expect(container.textContent).toContain('Retries: 8 of 10 correct');
    expect(container.textContent).toContain('(separate from skill accuracy above)');
  });
});
