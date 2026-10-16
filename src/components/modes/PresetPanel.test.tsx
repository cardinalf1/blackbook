import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as modeLoad from '../../services/modes/load';
import type { CleanSetStats } from '../../services/modes/presets';
import { PresetPanel } from './PresetPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/modes/load', () => ({
  loadCleanSetStats: vi.fn(),
  startPreset: vi.fn(),
}));

describe('PresetPanel', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const mockStats: CleanSetStats = {
    preset: 'math800',
    sets: 5,
    cleanSets: 3,
    cleanStreak: 2,
    bestStreak: 3,
    slipsPerSet: 0.4,
    slipsByReason: {
      careless: 1,
      concept_gap: 1,
    },
    untagged: 0,
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.mocked(modeLoad.loadCleanSetStats).mockResolvedValue(mockStats);
    vi.mocked(modeLoad.startPreset).mockResolvedValue(undefined);
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

  it('renders presets and stats from loadCleanSetStats', async () => {
    const onStarted = vi.fn();
    root = createRoot(container);

    await act(async () => {
      root?.render(<PresetPanel onStarted={onStarted} />);
    });

    // Wait for promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Math 800');
    expect(container.textContent).toContain('English 800');
    expect(container.textContent).toContain('Conventions');

    // CleanSetCard contents
    expect(container.textContent).toContain('clean sets in a row');
    expect(container.textContent).toContain('Best streak');
    expect(container.textContent).toContain('Sets done');
    expect(container.textContent).toContain('Slips / set');
    expect(container.textContent).toContain('0.4');
    expect(container.textContent).toContain('Careless: 1');
    expect(container.textContent).toContain('untagged: 0');
  });

  it('starts a preset when Start button is clicked and calls onStarted', async () => {
    const onStarted = vi.fn();
    root = createRoot(container);

    await act(async () => {
      root?.render(<PresetPanel onStarted={onStarted} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const startButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Start'),
    );
    expect(startButtons.length).toBeGreaterThan(0);

    await act(async () => {
      startButtons[0]?.click();
    });

    expect(modeLoad.startPreset).toHaveBeenCalledTimes(1);
    expect(modeLoad.startPreset).toHaveBeenCalledWith('math800', 15);
    expect(onStarted).toHaveBeenCalledTimes(1);
  });
});
