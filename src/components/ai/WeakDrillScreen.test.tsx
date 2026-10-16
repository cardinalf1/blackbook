import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as modeLoad from '../../services/modes/load';
import { aiStore } from '../../services/storage';
import type { AiPreview, AiStatus, WeakDrillResult } from '../../types/ai';
import { WeakDrillScreen } from './WeakDrillScreen';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/storage', () => ({
  aiStore: {
    status: vi.fn(),
    updateSettings: vi.fn(),
    preview: vi.fn(),
    previewReport: vi.fn(),
    weakDrill: vi.fn(),
    report: vi.fn(),
  },
}));

vi.mock('../../services/modes/load', () => ({
  startWeakDrill: vi.fn(),
}));

describe('WeakDrillScreen', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const mockStatusWithoutPreview: AiStatus = {
    hasKey: true,
    keyProtection: 'encrypted',
    model: 'llama-3.3-70b-versatile',
    policyLine: 'Groq retention policy',
    settings: {
      enabled: true,
      includeText: false,
      textConfirmedAt: null,
      previewSeen: [],
    },
  };

  const mockPreview: AiPreview = {
    feature: 'weak_drill',
    model: 'llama-3.3-70b-versatile',
    usedText: false,
    body: { test: 'drill-payload' },
    questionCount: 15,
    approxTokens: 350,
  };

  const mockDrillResult: WeakDrillResult = {
    origin: 'ai',
    fallbackReason: null,
    questionIds: ['q1', 'q2'],
    groups: [
      {
        label: 'Transitions',
        reason: 'Focus on contrast transitions',
        questionIds: ['q1', 'q2'],
      },
    ],
    skills: [
      {
        skillCode: 'TRA',
        skill: 'Transitions',
        section: 'rw',
        answered: 5,
        correct: 2,
        lowerBound: 0.1,
      },
    ],
    cached: false,
    usedText: false,
    notes: ['Prioritized recent mistakes'],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();

    vi.mocked(aiStore.status).mockResolvedValue(mockStatusWithoutPreview);
    vi.mocked(aiStore.preview).mockResolvedValue(mockPreview);
    vi.mocked(aiStore.updateSettings).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['weak_drill'] },
    });
    vi.mocked(aiStore.weakDrill).mockResolvedValue(mockDrillResult);
    vi.mocked(modeLoad.startWeakDrill).mockResolvedValue(undefined);
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

  it('forces preview before first build when previewSeen lacks weak_drill', async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(<WeakDrillScreen onBack={vi.fn()} onStarted={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const buildBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Build drill'),
    );
    expect(buildBtn).toBeDefined();

    // First click: preview is not seen, so preview is forced
    await act(async () => {
      buildBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.preview).toHaveBeenCalledWith('weak_drill', {
      section: 'both',
      size: 20,
      ruleOnly: false,
    });
    expect(aiStore.updateSettings).toHaveBeenCalledWith({
      previewSeen: ['weak_drill'],
    });
    expect(aiStore.weakDrill).not.toHaveBeenCalled();

    // Preview rendered in DOM
    expect(container.textContent).toContain('Payload Preview (weak_drill)');
    expect(container.textContent).toContain('drill-payload');
    expect(container.textContent).toContain('Questions: 15');
    expect(container.textContent).toContain('Approx tokens: 350');
    expect(container.textContent).toContain('Question text: Not included');

    // Second click: now previewSeen includes 'weak_drill', so weakDrill is called
    await act(async () => {
      buildBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.weakDrill).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Drill Built');
  });

  it('renders origin labels, skills table, groups, and starts drill', async () => {
    // Start with preview already seen
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['weak_drill'] },
    });

    const onStarted = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root?.render(<WeakDrillScreen onBack={vi.fn()} onStarted={onStarted} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const buildBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Build drill'),
    );
    await act(async () => {
      buildBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Check origin label
    expect(container.textContent).toContain('AI-assisted');
    // Check skills table
    expect(container.textContent).toContain('Transitions');
    expect(container.textContent).toContain('2 of 5');
    // Check groups
    expect(container.textContent).toContain('Focus on contrast transitions');
    expect(container.textContent).toContain('2 questions');
    // Fallback notes
    expect(container.textContent).toContain('Prioritized recent mistakes');

    // Start drill
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start this drill'),
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(modeLoad.startWeakDrill).toHaveBeenCalledWith(mockDrillResult);
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('renders rule-based origin and fallback notes when fallbackReason is set', async () => {
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['weak_drill'] },
    });
    vi.mocked(aiStore.weakDrill).mockResolvedValue({
      ...mockDrillResult,
      origin: 'rule',
      fallbackReason: 'no_key',
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<WeakDrillScreen onBack={vi.fn()} onStarted={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const buildBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Build drill'),
    );
    await act(async () => {
      buildBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('rule-based');
    expect(container.textContent).toContain('Needs a Groq key in Settings');
  });

  it('shows Groq key warning when AI is off or key is missing, and still allows building', async () => {
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      hasKey: false,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['weak_drill'] },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<WeakDrillScreen onBack={vi.fn()} onStarted={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain(
      'Needs a Groq key in Settings (AI is off). The rule-based version runs instead.',
    );

    const buildBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Build drill'),
    );
    expect(buildBtn?.disabled).toBe(false);
  });
});
