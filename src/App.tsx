import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WelcomeScreen } from './components/release/WelcomeScreen';
import { HelpScreen } from './components/release/HelpScreen';
import { AboutScreen } from './components/release/AboutScreen';
import { LicensesScreen } from './components/release/LicensesScreen';
import { installDesktopHooks } from './services/desktop';
import { APP_VERSION } from './version';
import { useCallback, useEffect, useState } from 'react';
import { AnalyticsFlow } from './components/analytics/AnalyticsFlow';
import { loadFacets } from './services/drill/facetCache';
import type { DrillConfig } from './types/drill';
import { DownloadController } from './components/download/DownloadController';
import { DrillFlow, ReportScreen, type DrillStart } from './components/drill/DrillFlow';
import { MistakeLogScreen } from './components/mistakes/MistakeLogScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { WeakDrillScreen } from './components/ai/WeakDrillScreen';
import { AiReportScreen } from './components/ai/AiReportScreen';
import { ImportPanel } from './components/ImportPanel';
import { BrowseScreen } from './components/browse/BrowseScreen';
import { InProgressSection } from './components/drill/InProgressSection';
import { ExamFlow } from './components/exam/ExamFlow';
import { TestFlow } from './components/test/TestFlow';
import { QuestionView } from './components/QuestionView';
import { HomeScreen } from './components/home/HomeScreen';
import { BankScreen } from './components/home/BankScreen';
import { RulesNotesScreen } from './components/home/RulesNotesScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { T } from './components/ui/tokens';
import { DOWNLOAD_ENABLED } from './config';
import { api, ApiError, initApiAuth } from './services/api/client';
import { questionStore } from './services/storage';
import { startTelemetry } from './services/telemetry';
import { drillStore } from './stores/drillStore';
import type { Question } from './types/sat';
import type { AnalyticsTab } from './types/analytics';
import type { CoachAction } from './types/ai';
import type { DashboardLink } from './types/dashboard';
import type { TestKind } from './types/test';
import { startRetryNow } from './services/retry/load';
import { loadHomeState, type HomeState } from './services/home/load';
import { LEGACY_REDIRECTS, type LegacyView, type ScreenId } from './services/home/routes';

const PRACTICE_SIZE = 20;
/** Tells the local program a Blackbook page is still open, so it does not shut down when idle. */
const HEARTBEAT_MS = 60_000;

type View =
  | { kind: 'loading' }
  | { kind: 'help' }
  | { kind: 'about' }
  | { kind: 'licenses' }
  | { kind: 'welcome' }

  | { kind: 'home'; count: number; home: HomeState | null }
  | { kind: 'practice'; questions: Question[]; index: number }
  | { kind: 'browse'; random?: boolean }
  | { kind: 'dashboard' }
  /** An old analytics page, now a drill-down from the Dashboard. */
  | { kind: 'detail'; tab: AnalyticsTab; skill?: string }
  /** The Phase 7 study report, now a drill-down from the Dashboard. */
  | { kind: 'studyReport' }
  | { kind: 'mistakes' }
  | { kind: 'settings' }
  | { kind: 'weakDrill' }
  | { kind: 'bank' }
  | { kind: 'rulesNotes' }
  | { kind: 'inProgress' }
  | { kind: 'mistakeReport'; sessionId: string; back: 'mistakes' | 'dashboard' }
  | { kind: 'drill'; startAt: DrillStart }
  | { kind: 'exam'; startAt: 'setup' | 'play' }
  | { kind: 'test'; startAt: 'setup' | 'open'; testId?: string; initialKind?: TestKind };

/** Where one destination id opens. Old top-level views go through LEGACY_REDIRECTS first. */
export function viewFor(to: ScreenId | LegacyView): Exclude<View, { kind: 'loading' | 'home' | 'practice' | 'mistakeReport' }> | 'random20' | 'home' {
  const id: ScreenId = to in LEGACY_REDIRECTS ? LEGACY_REDIRECTS[to as LegacyView] : (to as ScreenId);
  switch (id) {
    case 'home':
      return 'home';
    case 'drill_setup':
      return { kind: 'drill', startAt: 'setup' };
    case 'modes800':
      return { kind: 'drill', startAt: 'modes' };
    case 'random20':
      return 'random20';
    case 'weak_drill':
      return { kind: 'weakDrill' };
    case 'random_question':
      return { kind: 'browse', random: true };
    case 'test_chooser':
    case 'test_setup_full':
      return { kind: 'test', startAt: 'setup', initialKind: 'full' };
    case 'test_setup_section':
      return { kind: 'test', startAt: 'setup', initialKind: 'rw' };
    case 'exam_setup':
      return { kind: 'exam', startAt: 'setup' };
    case 'dashboard':
      return { kind: 'dashboard' };
    case 'past':
      return { kind: 'drill', startAt: 'past' };
    case 'mistakes':
      return { kind: 'mistakes' };
    case 'browse':
      return { kind: 'browse' };
    case 'rules_notes':
      return { kind: 'rulesNotes' };
    case 'settings':
      return { kind: 'settings' };
    case 'data':
      return { kind: 'drill', startAt: 'data' };
    case 'bank':
      return { kind: 'bank' };
    case 'in_progress':
      return { kind: 'inProgress' };
    case 'detail_overview':
      return { kind: 'detail', tab: 'overview' };
    case 'detail_skills':
      return { kind: 'detail', tab: 'skills' };
    case 'detail_timing':
      return { kind: 'detail', tab: 'timing' };
    case 'detail_behavior':
      return { kind: 'detail', tab: 'behavior' };
    case 'detail_tests':
      return { kind: 'detail', tab: 'tests' };
    case 'detail_study':
      return { kind: 'detail', tab: 'study' };
    case 'detail_report':
      return { kind: 'studyReport' };
    case 'my_skills':
      return { kind: 'drill', startAt: 'skills' };
  }
}

function sample<T>(items: readonly T[], n: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, n);
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [bankCount, setBankCount] = useState(0);
  const [lookedAround, setLookedAround] = useState(false);

  useEffect(() => {
    installDesktopHooks((page) => {
      if (page === 'help') setView({ kind: 'help' });
      else if (page === 'about') setView({ kind: 'about' });
    });
  }, []);

  const loadHome = useCallback(async () => {
    setError(null);
    try {
      await initApiAuth();
      startTelemetry();
      const count = await questionStore.count();
      setBankCount(count);
      setView({ kind: 'home', count, home: null });
      const home = count > 0 ? await loadHomeState(count).catch(() => null) : null;
      setView((v) => (v.kind === 'home' ? { kind: 'home', count, home } : v));
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

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  /** Starts a drill from a prefilled config (coach, Study next, skills map) through the normal drill start. */
  const launchDrill = async (config: DrillConfig) => {
    try {
      const facets = await loadFacets(questionStore);
      await drillStore.getState().start(config, facets);
      const session = drillStore.getState().session;
      if (session) setView({ kind: 'drill', startAt: 'play' });
      else setError(drillStore.getState().error ?? 'Could not start that drill.');
    } catch (e) {
      fail(e);
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
      fail(e);
    }
  };

  const go = (to: ScreenId) => {
    const v = viewFor(to);
    if (v === 'home') void loadHome();
    else if (v === 'random20') void startPractice();
    else setView(v);
  };

  const resumed = () => setView(drillStore.getState().session?.mode === 'exam' ? { kind: 'exam', startAt: 'play' } : { kind: 'drill', startAt: 'play' });

  const runUpNext = (home: HomeState) => {
    const p = home.upNext.primary;
    if (p.kind === 'resume') {
      if (p.isTest) setView({ kind: 'test', startAt: 'open', testId: p.sessionId });
      else
        void drillStore
          .getState()
          .resume(p.sessionId)
          .then(() => (drillStore.getState().session?.id === p.sessionId ? resumed() : setError(drillStore.getState().error ?? 'Could not resume.')), fail);
    } else if (p.kind === 'retry') void handleStartRetry();
    else if (p.kind === 'weak_drill') setView({ kind: 'weakDrill' });
    else void launchDrill({ section: p.section, domainCode: 'all', skillCodes: [], difficulties: [], count: p.size, liveOnly: true });
  };

  const onCoachAction = (a: CoachAction) => {
    if (a.kind === 'drill') void launchDrill(a.config);
    else if (a.kind === 'retry') void handleStartRetry();
    else go(a.target === 'exam_setup' ? 'exam_setup' : a.target === 'mistakes' ? 'mistakes' : 'drill_setup');
  };

  const onDashboardLink = (l: DashboardLink) => {
    if (l.to === 'skill') setView({ kind: 'detail', tab: 'skills', skill: l.skillCode });
    else if (l.to === 'test') setView({ kind: 'test', startAt: 'open', testId: l.testId });
    else if (l.to === 'report') setView({ kind: 'studyReport' });
    else if (l.to === 'mistakes') setView({ kind: 'mistakes' });
    else if (l.to === 'past') setView({ kind: 'drill', startAt: 'past' });
    else setView({ kind: 'detail', tab: l.to });
  };

  const toDashboard = () => setView({ kind: 'dashboard' });
  const mySkills = () => setView({ kind: 'drill', startAt: 'skills' });
  const isHome = view.kind === 'home' && view.count > 0;

  return (
    <ErrorBoundary>
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {!isHome && (
        <header className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="font-mono text-lg">Blackbook</h1>
            <nav className="flex items-center gap-3 text-xs">
              <button type="button" onClick={() => setView({ kind: 'help' })} className="text-zinc-400 hover:text-zinc-200">
                Help
              </button>
              <button type="button" onClick={() => setView({ kind: 'about' })} className="text-zinc-400 hover:text-zinc-200">
                About
              </button>
            </nav>
          </div>
          <p className="text-xs text-zinc-500">Independent practice tool. Not affiliated with any testing organization.</p>
        </header>
      )}

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-[2px] border border-[#27272A] bg-black p-4 text-sm text-white" role="alert">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => void loadHome()} className={T.primary}>
            Retry
          </button>
        </div>
      )}

      {view.kind === 'home' && view.count > 0 && (
        view.home ? (
          <HomeScreen
            status={{ questions: view.home.questions, done: view.home.done }}
            upNext={view.home.upNext}
            poolLine={view.home.poolLine}
            onPrimary={() => view.home && runUpNext(view.home)}
            onNavigate={go}
          />
        ) : (
          <p className={T.muted}>Loading...</p>
        )
      )}

      {/* With no bank, show Welcome screen on first run, or download controller after. */}
      {view.kind === 'home' && view.count === 0 && !lookedAround && (
        <WelcomeScreen
          downloadEnabled={DOWNLOAD_ENABLED}
          onDownload={() => setLookedAround(true)}
          onImport={() => setView({ kind: 'bank' })}
          onLookAround={() => setLookedAround(true)}
        />
      )}

      {view.kind === 'home' && view.count === 0 && lookedAround &&
        (DOWNLOAD_ENABLED ? (
          <DownloadController hasBank={false} questionCount={0} importSlot={<ImportPanel onImported={reloadHome} />} onBankChanged={reloadHome} />
        ) : (
          <ImportPanel onImported={reloadHome} />
        ))}

      {view.kind === 'bank' && <BankScreen questionCount={bankCount} onBankChanged={reloadHome} onBack={() => void loadHome()} />}

      {view.kind === 'rulesNotes' && <RulesNotesScreen onBack={() => void loadHome()} />}

      {view.kind === 'inProgress' && (
        <section className="space-y-4">
          <button type="button" onClick={() => void loadHome()} className={T.secondary}>
            Back
          </button>
          <InProgressSection onOpenTest={(testId) => setView({ kind: 'test', startAt: 'open', testId })} onResumed={resumed} />
        </section>
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
          {view.questions[view.index] && <QuestionView key={view.questions[view.index]?.id} question={view.questions[view.index] as Question} />}
        </section>
      )}

      {view.kind === 'drill' && (
        <DrillFlow
          startAt={view.startAt}
          onExit={() => void loadHome()}
          onOpenExam={() => setView({ kind: 'exam', startAt: 'play' })}
          onOpenTest={(testId) => setView({ kind: 'test', startAt: 'open', testId })}
          onRandom20={() => void startPractice()}
        />
      )}
      {view.kind === 'exam' && <ExamFlow startAt={view.startAt} onExit={() => void loadHome()} onMySkills={mySkills} />}

      {view.kind === 'test' && (
        <TestFlow startAt={view.startAt} testId={view.testId} initialKind={view.initialKind} onExit={() => void loadHome()} onMySkills={mySkills} />
      )}

      {view.kind === 'dashboard' && (
        <DashboardScreen
          actions={{ onAction: onCoachAction, onLink: onDashboardLink, onTagSession: (sessionId) => setView({ kind: 'mistakeReport', sessionId, back: 'dashboard' }) }}
          onBack={() => void loadHome()}
          onOpenTest={(testId) => setView({ kind: 'test', startAt: 'open', testId })}
          onOpen={go}
        />
      )}

      {view.kind === 'detail' && (
        <AnalyticsFlow key={`${view.tab}:${view.skill ?? ''}`} startTab={view.tab} initialSkill={view.skill} onExit={toDashboard} onLaunch={(config) => void launchDrill(config)} />
      )}

      {view.kind === 'studyReport' && <AiReportScreen onBack={toDashboard} />}

      {view.kind === 'settings' && <SettingsScreen onBack={() => void loadHome()} />}

      {view.kind === 'weakDrill' && (
        <WeakDrillScreen onBack={() => void loadHome()} onStarted={() => drillStore.getState().session && setView({ kind: 'drill', startAt: 'play' })} />
      )}

      {view.kind === 'mistakes' && (
        <MistakeLogScreen onBack={() => void loadHome()} onOpenReport={(sessionId) => setView({ kind: 'mistakeReport', sessionId, back: 'mistakes' })} />
      )}

      {view.kind === 'mistakeReport' && (
        <ReportScreen
          sessionId={view.sessionId}
          backLabel={view.back === 'dashboard' ? 'Back to dashboard' : 'Back to mistake log'}
          onBack={() => setView(view.back === 'dashboard' ? { kind: 'dashboard' } : { kind: 'mistakes' })}
          onMySkills={mySkills}
        />
      )}

      {view.kind === 'browse' && <BrowseScreen onBack={() => void loadHome()} onMySkills={mySkills} startRandom={view.random === true} />}
      {view.kind === 'help' && (
        <HelpScreen
          desktop={typeof window !== 'undefined' && !!window.blackbookDesktop}
          dataFolder={null}
          onOpenDataFolder={() => window.blackbookDesktop?.openDataFolder()}
          onCopyDiagnostics={async () => {
            try {
              await navigator.clipboard.writeText(`Blackbook v${APP_VERSION}\nPlatform: ${navigator.userAgent}`);
              return true;
            } catch {
              return false;
            }
          }}
          onOpenSettings={() => setView({ kind: 'settings' })}
          onBack={() => void loadHome()}
        />
      )}

      {view.kind === 'about' && (
        <AboutScreen
          version={APP_VERSION}
          electron={null}
          platform={typeof navigator !== 'undefined' ? navigator.platform : null}
          onOpenLicenses={() => setView({ kind: 'licenses' })}
          onBack={() => void loadHome()}
        />
      )}

      {view.kind === 'licenses' && (
        <LicensesScreen onBack={() => setView({ kind: 'about' })} />
      )}
    </main>
    </ErrorBoundary>
  );
}
