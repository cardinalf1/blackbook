import { useCallback, useEffect, useState } from 'react';
import { AnalyticsFlow } from './components/analytics/AnalyticsFlow';
import { loadFacets } from './services/drill/facetCache';
import type { DrillConfig } from './types/drill';
import { DownloadController } from './components/download/DownloadController';
import { DrillFlow, ReportScreen, type DrillStart } from './components/drill/DrillFlow';
import { MistakeLogScreen } from './components/mistakes/MistakeLogScreen';
import { ImportPanel } from './components/ImportPanel';
import { BrowseScreen } from './components/browse/BrowseScreen';
import { InProgressSection } from './components/drill/InProgressSection';
import { ExamFlow } from './components/exam/ExamFlow';
import { TestFlow } from './components/test/TestFlow';
import { QuestionView } from './components/QuestionView';
import { DOWNLOAD_ENABLED } from './config';
import { api, ApiError, initApiAuth } from './services/api/client';
import { questionStore, type BankMeta } from './services/storage';
import { startTelemetry } from './services/telemetry';
import { drillStore, useDrill } from './stores/drillStore';
import type { Question } from './types/sat';
import { loadPoolHealth, loadRetryState, startRetryNow, type PoolHealthView, type RetryState } from './services/retry/load';

const PRACTICE_SIZE = 20;
/** Tells the local program a Blackbook page is still open, so it does not shut down when idle. */
const HEARTBEAT_MS = 60_000;

type View =
  | { kind: 'loading' }
  | { kind: 'home'; meta: BankMeta | null; count: number }
  | { kind: 'practice'; questions: Question[]; index: number }
  | { kind: 'browse' }
  | { kind: 'analytics' }
  | { kind: 'mistakes' }
  | { kind: 'mistakeReport'; sessionId: string }
  | { kind: 'drill'; startAt: DrillStart }
  | { kind: 'exam'; startAt: 'setup' | 'play' }
  | { kind: 'test'; startAt: 'setup' | 'open'; testId?: string };

function sample<T>(items: readonly T[], n: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, n);
}

function formatPoolEstimate(n: number): string {
  return n >= 50 ? '50 or more' : String(n);
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [retryState, setRetryState] = useState<RetryState | null>(null);
  const [poolHealth, setPoolHealth] = useState<PoolHealthView | null>(null);

  const loadHome = useCallback(async () => {
    setError(null);
    try {
      await initApiAuth();
      startTelemetry();
      const [meta, count, retry, health] = await Promise.all([
        questionStore.getMeta(),
        questionStore.count(),
        loadRetryState().catch(() => null),
        loadPoolHealth().catch(() => null),
        drillStore.getState().init(),
      ]);
      setRetryState(retry);
      setPoolHealth(health);
      setView({ kind: 'home', meta, count });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('This page has no access to Blackbook. Open Blackbook again from the link its launcher printed.');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

  const reloadHome = useCallback(() => void loadHome(), [loadHome]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    const t = window.setInterval(() => void api.request('/api/health').catch(() => undefined), HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, []);

  /** Starts a drill from a prefilled config (Study next) through the normal drill start. */
  const launchDrill = async (config: DrillConfig) => {
    try {
      const facets = await loadFacets(questionStore);
      await drillStore.getState().start(config, facets);
      const session = drillStore.getState().session;
      if (session) setView({ kind: 'drill', startAt: 'play' });
      else setError(drillStore.getState().error ?? 'Could not start that drill.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startPractice = async () => {
    const all = await questionStore.query({});
    setView({ kind: 'practice', questions: sample(all, PRACTICE_SIZE), index: 0 });
  };

  const handleStartRetry = async () => {
    try {
      await startRetryNow();
      const session = drillStore.getState().session;
      if (session) setView({ kind: 'drill', startAt: 'play' });
      else setError(drillStore.getState().error ?? 'Could not start retry session.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg">Blackbook</h1>
        <p className="text-xs text-zinc-500">Independent practice tool. Not affiliated with any testing organization.</p>
      </header>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void loadHome()}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Retry
          </button>
        </div>
      )}

      {view.kind === 'home' && (
        <>
          {retryState && retryState.dueCount > 0 && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  {retryState.dueCount} questions due for retry
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleStartRetry()}
                className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Start retry
              </button>
            </section>
          )}

          {retryState && retryState.dueCount === 0 && retryState.queue.length > 0 && (
            <p className="text-xs text-zinc-500">No retries due</p>
          )}

          {poolHealth && (
            <p className="text-xs text-zinc-400">
              Full tests left: {formatPoolEstimate(poolHealth.fresh.full)}, Reading and Writing: {formatPoolEstimate(poolHealth.fresh.rw)}, Math: {formatPoolEstimate(poolHealth.fresh.math)} (estimate)
            </p>
          )}

          {view.count > 0 && view.meta && (
            <section className="flex flex-wrap items-center gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
              <div className="text-sm">
                <div>{view.count} questions loaded</div>
                <div className="text-xs text-zinc-500">
                  Synced {new Date(view.meta.fetchedAt).toLocaleString()}, imported {new Date(view.meta.importedAt).toLocaleString()}
                </div>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'setup' })}
                  className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900"
                >
                  Start a drill
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'exam', startAt: 'setup' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Practice module
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'test', startAt: 'setup' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Practice test
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'skills' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  My skills
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'analytics' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Analytics
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'past' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Past drills
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'drill', startAt: 'data' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Your data
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'mistakes' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Mistake log
                </button>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'browse' })}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Browse questions
                </button>
                <button
                  type="button"
                  onClick={() => void startPractice()}
                  className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm font-medium text-zinc-100 hover:border-zinc-500"
                >
                  Step through {Math.min(PRACTICE_SIZE, view.count)} random questions
                </button>
              </div>
            </section>
          )}
          {view.count > 0 && (
            <InProgressSection
              onOpenTest={(testId) => setView({ kind: 'test', startAt: 'open', testId })}
              onResumed={() =>
                setView(drillStore.getState().session?.mode === 'exam' ? { kind: 'exam', startAt: 'play' } : { kind: 'drill', startAt: 'play' })
              }
            />
          )}
          {DOWNLOAD_ENABLED ? (
            <>
              <DownloadController
                hasBank={view.count > 0}
                questionCount={view.count}
                importSlot={<ImportPanel onImported={reloadHome} />}
                onBankChanged={reloadHome}
              />
              {view.count > 0 && <ImportPanel onImported={reloadHome} />}
            </>
          ) : (
            <ImportPanel onImported={reloadHome} />
          )}
        </>
      )}

      {view.kind === 'practice' && (
        <section className="space-y-4">
          <nav className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => void loadHome()} className="text-zinc-400 hover:text-zinc-100">
              Back
            </button>
            <span className="ml-auto font-mono text-xs text-zinc-400">
              {view.index + 1} / {view.questions.length}
            </span>
            <button
              type="button"
              disabled={view.index === 0}
              onClick={() => setView({ ...view, index: view.index - 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={view.index === view.questions.length - 1}
              onClick={() => setView({ ...view, index: view.index + 1 })}
              className="rounded-md border border-[#27272A] px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </nav>
          {view.questions[view.index] && (
            <QuestionView key={view.questions[view.index]?.id} question={view.questions[view.index] as Question} />
          )}
        </section>
      )}

      {view.kind === 'drill' && (
        <DrillFlow
          startAt={view.startAt}
          onExit={() => void loadHome()}
          onOpenExam={() => setView({ kind: 'exam', startAt: 'play' })}
          onOpenTest={(testId) => setView({ kind: 'test', startAt: 'open', testId })}
        />
      )}
      {view.kind === 'exam' && (
        <ExamFlow startAt={view.startAt} onExit={() => void loadHome()} onMySkills={() => setView({ kind: 'drill', startAt: 'skills' })} />
      )}

      {view.kind === 'test' && (
        <TestFlow
          startAt={view.startAt}
          testId={view.testId}
          onExit={() => void loadHome()}
          onMySkills={() => setView({ kind: 'drill', startAt: 'skills' })}
        />
      )}

      {view.kind === 'analytics' && <AnalyticsFlow onExit={() => void loadHome()} onLaunch={(config) => void launchDrill(config)} />}

      {view.kind === 'mistakes' && (
        <MistakeLogScreen onBack={() => void loadHome()} onOpenReport={(sessionId) => setView({ kind: 'mistakeReport', sessionId })} />
      )}

      {view.kind === 'mistakeReport' && (
        <ReportScreen
          sessionId={view.sessionId}
          backLabel="Back to mistake log"
          onBack={() => setView({ kind: 'mistakes' })}
          onMySkills={() => setView({ kind: 'drill', startAt: 'skills' })}
        />
      )}

      {view.kind === 'browse' && <BrowseScreen onBack={() => void loadHome()} onMySkills={() => setView({ kind: 'drill', startAt: 'skills' })} />}
    </main>
  );
}
