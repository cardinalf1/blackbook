import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  loadRetryState: vi.fn(),
  startRetryNow: vi.fn(),
  loadPoolHealth: vi.fn(),
  session: null as unknown,
}));

vi.mock('./services/api/client', () => ({
  initApiAuth: vi.fn().mockResolvedValue(undefined),
  startTelemetry: vi.fn(),
  api: {
    request: vi.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {
    status = 500;
  },
}));

vi.mock(import('./services/storage'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    questionStore: {
      ...actual.questionStore,
      getMeta: vi.fn().mockResolvedValue({
        fetchedAt: 1700000000000,
        importedAt: 1700000000000,
      }),
      count: vi.fn().mockResolvedValue(100),
      query: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock('./stores/drillStore', () => ({
  drillStore: {
    getState: () => ({
      init: vi.fn().mockResolvedValue(undefined),
      session: mocks.session,
      error: null,
      start: vi.fn(),
    }),
    subscribe: vi.fn(() => () => undefined),
  },
  useDrill: (selector: (state: { error: string | null }) => unknown) => selector({ error: null }),
}));

vi.mock('./services/retry/load', () => ({
  loadRetryState: () => mocks.loadRetryState(),
  startRetryNow: () => mocks.startRetryNow(),
  loadPoolHealth: () => mocks.loadPoolHealth(),
}));

vi.mock('./components/drill/DrillFlow', () => ({
  DrillFlow: ({ startAt }: { startAt: string }) => (
    <div data-testid="drill-flow">DrillFlow startAt={startAt}</div>
  ),
}));

vi.mock('./components/drill/InProgressSection', () => ({
  InProgressSection: () => null,
}));

vi.mock('./components/download/DownloadController', () => ({
  DownloadController: () => null,
}));

vi.mock('./components/ImportPanel', () => ({
  ImportPanel: () => null,
}));

describe('App Home Screen - Retry & Pool UI', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mocks.session = null;
    mocks.startRetryNow.mockReset();
    mocks.startRetryNow.mockImplementation(async () => {
      mocks.session = { id: 'retry-sess' };
    });
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

  it('renders retry card and pool health estimate, and clicking Start retry launches drill', async () => {
    mocks.loadRetryState.mockResolvedValue({
      queue: [
        { questionId: 'q1', intervalDays: 1, dueAt: Date.now() - 1000, lastAnsweredAt: Date.now() - 2000, step: 1 },
      ],
      dueCount: 3,
      accuracy: { answered: 5, correct: 4 },
    });

    mocks.loadPoolHealth.mockResolvedValue({
      fresh: { rw: 50, math: 25, full: 20, capped: true },
      withSeen: { rw: 50, math: 30, full: 25, capped: true },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });

    expect(container.textContent).toContain('3 questions due for retry');
    expect(container.textContent).toContain(
      'Full tests left: 20, Reading and Writing: 50 or more, Math: 25 (estimate)',
    );

    const startRetryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Start retry',
    );
    expect(startRetryBtn).toBeDefined();

    await act(async () => {
      startRetryBtn?.click();
    });

    expect(mocks.startRetryNow).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="drill-flow"]')?.textContent).toContain(
      'DrillFlow startAt=play',
    );
  });

  it('shows "No retries due" when dueCount is 0 but queue has items', async () => {
    mocks.loadRetryState.mockResolvedValue({
      queue: [
        { questionId: 'q1', intervalDays: 1, dueAt: Date.now() + 100000, lastAnsweredAt: Date.now(), step: 1 },
      ],
      dueCount: 0,
      accuracy: { answered: 5, correct: 4 },
    });

    mocks.loadPoolHealth.mockResolvedValue({
      fresh: { rw: 10, math: 12, full: 8, capped: false },
      withSeen: { rw: 15, math: 16, full: 12, capped: false },
    });

    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });

    expect(container.textContent).toContain('No retries due');
    expect(container.textContent).not.toContain('questions due for retry');
    expect(container.textContent).toContain(
      'Full tests left: 8, Reading and Writing: 10, Math: 12 (estimate)',
    );
  });
});
