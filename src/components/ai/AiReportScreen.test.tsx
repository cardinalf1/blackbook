import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiStore } from '../../services/storage';
import type { AiPreview, AiStatus, InsightReport } from '../../types/ai';
import { AiReportScreen } from './AiReportScreen';

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

describe('AiReportScreen', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const mockStatusWithoutPreview: AiStatus = {
    hasKey: true,
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
    feature: 'report',
    model: 'llama-3.3-70b-versatile',
    usedText: false,
    body: { test: 'report-payload' },
    questionCount: 0,
    approxTokens: 180,
  };

  const mockReport: InsightReport = {
    period: 'last_test',
    origin: 'ai',
    fallbackReason: null,
    generatedAt: 123456,
    cached: false,
    dropped: 2,
    lines: [
      {
        insightId: 'skills_below_target',
        title: 'Skills below target',
        headline: 'Linear equations need focus',
        sentence: 'You missed 3 of 4 algebra questions involving two variables.',
        action: null,
        sampleSize: 4,
        thin: true,
      },
    ],
    nextWeek: 'Practice 15 algebra questions focusing on substitution and elimination.',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();

    vi.mocked(aiStore.status).mockResolvedValue(mockStatusWithoutPreview);
    vi.mocked(aiStore.previewReport).mockResolvedValue(mockPreview);
    vi.mocked(aiStore.updateSettings).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['report'] },
    });
    vi.mocked(aiStore.report).mockResolvedValue(mockReport);
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

  it('forces preview before first report when previewSeen lacks report', async () => {
    root = createRoot(container);
    await act(async () => {
      root?.render(<AiReportScreen onBack={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.previewReport).toHaveBeenCalledWith('last_test');
    expect(aiStore.updateSettings).toHaveBeenCalledWith({
      previewSeen: ['report'],
    });
    expect(aiStore.report).not.toHaveBeenCalled();

    // Verify preview rendered
    expect(container.textContent).toContain('Payload Preview (report)');
    expect(container.textContent).toContain('report-payload');
  });

  it('renders report lines, origin labels, thin data badge, dropped count, and next week', async () => {
    // Already seen preview
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['report'] },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<AiReportScreen onBack={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.report).toHaveBeenCalledWith('last_test', false);

    // Origin label
    expect(container.textContent).toContain('AI-assisted');

    // Report line elements
    expect(container.textContent).toContain('Skills below target');
    expect(container.textContent).toContain('Linear equations need focus');
    expect(container.textContent).toContain(
      'You missed 3 of 4 algebra questions involving two variables.',
    );
    expect(container.textContent).toContain('Sample size: 4');
    expect(container.textContent).toContain('thin data');

    // Dropped count message
    expect(container.textContent).toContain(
      '2 sentences were dropped because they used numbers that were not in the data',
    );

    // Next week
    expect(container.textContent).toContain('What to do next week');
    expect(container.textContent).toContain(
      'Practice 15 algebra questions focusing on substitution and elimination.',
    );
  });

  it('calls report with regenerate=true when Regenerate is clicked', async () => {
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['report'] },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<AiReportScreen onBack={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const regenBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Regenerate'),
    );
    expect(regenBtn).toBeDefined();

    await act(async () => {
      regenBtn?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.report).toHaveBeenCalledWith('last_test', true);
  });

  it('renders rule-based origin and fallback notes when fallbackReason is no_key', async () => {
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['report'] },
    });
    vi.mocked(aiStore.report).mockResolvedValue({
      ...mockReport,
      origin: 'rule',
      fallbackReason: 'no_key',
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<AiReportScreen onBack={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('rule-based');
    expect(container.textContent).toContain('Needs a Groq key in Settings');
  });

  it('switches tabs and requests report for the new period', async () => {
    vi.mocked(aiStore.status).mockResolvedValue({
      ...mockStatusWithoutPreview,
      settings: { ...mockStatusWithoutPreview.settings, previewSeen: ['report'] },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<AiReportScreen onBack={vi.fn()} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const weekTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Last 7 days'),
    );
    expect(weekTab).toBeDefined();

    await act(async () => {
      weekTab?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(aiStore.report).toHaveBeenCalledWith('last_7_days', false);
  });
});
