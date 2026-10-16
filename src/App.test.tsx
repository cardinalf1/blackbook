import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { viewFor } from './App';
import type { HomeState } from './services/home/load';
import { DASHBOARD_DETAIL_LINKS, HOME_GROUPS, SETTINGS_MENU, TEST_CHOOSER, type ScreenId } from './services/home/routes';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  startRetryNow: vi.fn(),
  loadHomeState: vi.fn(),
  count: vi.fn(),
  session: null as unknown,
}));

vi.mock('./services/api/client', () => ({
  initApiAuth: vi.fn().mockResolvedValue(undefined),
  api: { request: vi.fn().mockResolvedValue({}) },
  ApiError: class ApiError extends Error {
    status = 500;
  },
}));

vi.mock(import('./services/telemetry'), async (importOriginal) => ({ ...(await importOriginal()), startTelemetry: vi.fn() }));

vi.mock(import('./services/storage'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    questionStore: { ...actual.questionStore, count: () => mocks.count(), query: vi.fn().mockResolvedValue([]) },
  };
});

vi.mock('./stores/drillStore', () => ({
  drillStore: {
    getState: () => ({ init: vi.fn().mockResolvedValue(undefined), session: mocks.session, error: null, start: vi.fn() }),
    subscribe: vi.fn(() => () => undefined),
  },
  useDrill: (selector: (state: { error: string | null }) => unknown) => selector({ error: null }),
}));

vi.mock('./services/retry/load', () => ({ startRetryNow: () => mocks.startRetryNow() }));
vi.mock('./services/home/load', () => ({ loadHomeState: () => mocks.loadHomeState() }));

vi.mock('./components/drill/DrillFlow', () => ({
  DrillFlow: ({ startAt }: { startAt: string }) => <div data-testid="drill-flow">DrillFlow startAt={startAt}</div>,
  ReportScreen: () => null,
}));
vi.mock('./components/drill/InProgressSection', () => ({ InProgressSection: () => null }));
vi.mock('./components/download/DownloadController', () => ({ DownloadController: () => <div data-testid="download">Download questions</div> }));
vi.mock('./components/ImportPanel', () => ({ ImportPanel: () => <div data-testid="import">Import question bank</div> }));

const home = (over: Partial<HomeState> = {}): HomeState => ({
  questions: 3695,
  done: 148,
  poolLine: 'Fresh questions for about 6 full tests (estimate)',
  upNext: { primary: { kind: 'retry', due: 3, label: 'Review 3 questions due today', reason: 'Questions you missed earlier are due for another try.' }, moreInProgress: 0 },
  ...over,
});

describe('App after Phase 8', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const render = async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    mocks.session = null;
    mocks.count.mockResolvedValue(3695);
    mocks.loadHomeState.mockResolvedValue(home());
    mocks.startRetryNow.mockReset();
    mocks.startRetryNow.mockImplementation(async () => {
      mocks.session = { id: 'retry-sess' };
    });
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    container.remove();
  });

  it('with a loaded bank, Home shows one Up next action and no import form or duplicate bank cards', async () => {
    await render();
    expect(container.textContent).toContain('3,695 questions on this computer');
    expect(container.textContent).toContain('Fresh questions for about 6 full tests (estimate)');
    expect(container.querySelector('[data-testid="import"]')).toBeNull();
    expect(container.querySelector('[data-testid="download"]')).toBeNull();
    expect(container.textContent).not.toContain('questions loaded');
    expect(container.textContent).not.toMatch(/No retries due|Full tests left/);
    await act(async () => button('Review 3 questions due today')?.click());
    expect(mocks.startRetryNow).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="drill-flow"]')?.textContent).toContain('startAt=play');
  });

  it('the bank block moved to Settings menu > Question bank', async () => {
    await render();
    const gear = [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-haspopup'));
    await act(async () => gear?.click());
    await act(async () => button('Question bank')?.click() ?? [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Question bank'))?.click());
    expect(container.textContent).toContain('Question bank');
    expect(container.querySelector('[data-testid="import"]')).not.toBeNull();
  });

  it('with an empty bank, the empty-bank screen is the whole home', async () => {
    mocks.count.mockResolvedValue(0);
    await render();
    expect(container.querySelector('[data-testid="download"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Up next');
  });
});

describe('every destination opens a screen, and old views redirect', () => {
  it('maps every link on Home, the settings menu, the chooser and the dashboard', () => {
    const all: ScreenId[] = [...HOME_GROUPS.flatMap((g) => g.links.map((l) => l.to)), ...SETTINGS_MENU.map((l) => l.to), ...TEST_CHOOSER.map((l) => l.to), ...DASHBOARD_DETAIL_LINKS.map((l) => l.to), 'in_progress', 'random20'];
    for (const to of all) expect(viewFor(to), to).toBeTruthy();
  });

  it('Analytics, the study report and My skills no longer have a top-level entry: they redirect to the Dashboard', () => {
    expect(viewFor('analytics')).toEqual({ kind: 'dashboard' });
    expect(viewFor('aiReport')).toEqual({ kind: 'dashboard' });
    expect(viewFor('mySkillsTop')).toEqual({ kind: 'dashboard' });
    expect(viewFor('detail_report')).toEqual({ kind: 'studyReport' });
    expect(viewFor('detail_timing')).toEqual({ kind: 'detail', tab: 'timing' });
  });
});
