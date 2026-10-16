import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAttentionTelemetry } from '../../hooks/useAttentionTelemetry';
import { useFocusTimer } from '../../hooks/useFocusTimer';
import { loadFacets } from '../../services/drill/facetCache';
import { buildTaxonomy } from '../../services/drill/facets';
import { computeSkillStats, countableAttempts } from '../../services/drill/stats';
import { buildReport, pastSessionRows } from '../../services/session/report';
import { currentQuestionId, finishCheck, progressOf } from '../../services/session/record';
import { attemptStore, hiddenSessionsStore, questionStore, telemetryStore } from '../../services/storage';
import { telemetry } from '../../services/telemetry';
import { drillStore, useDrill } from '../../stores/drillStore';
import type { DrillConfig, QuestionFacet, SkillStatRow } from '../../types/drill';
import type { Question } from '../../types/sat';
import type { PastSessionRow, SessionRecord, SessionReport, TelemetryStats } from '../../types/session';
import { DataPage } from '../results/DataPage';
import { DrillReport } from '../results/DrillReport';
import { MySkills } from '../results/MySkills';
import { PastDrills } from '../results/PastDrills';
import { DrillPlay } from './DrillPlay';
import { DrillSetup } from './DrillSetup';
import { FinishConfirm } from './FinishConfirm';
import { InProgressSection } from './InProgressSection';

export type DrillStart = 'setup' | 'modes' | 'play' | 'skills' | 'past' | 'data';

type Step =
  | { kind: 'setup' }
  | { kind: 'play' }
  | { kind: 'skills'; back: Step | null }
  | { kind: 'past' }
  | { kind: 'data' }
  | { kind: 'report'; sessionId: string; from: 'drill' | 'past' };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return error ? (
    <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">
      {children}
    </div>
  ) : (
    <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">{children}</div>
  );
}

/**
 * Setup, the question loop, the report, Past drills, the Data page and the skills table. Session
 * state lives in the drill store; this component chooses the screen and loads what it shows.
 */
export function DrillFlow({ onExit, startAt, onOpenExam, onOpenTest, onRandom20 }: { onExit: () => void; startAt: DrillStart; onOpenExam?: () => void; onOpenTest?: (testId: string) => void; onRandom20?: () => void }) {
  const error = useDrill((s) => s.error);
  const [step, setStep] = useState<Step>(startAt === 'skills' ? { kind: 'skills', back: null } : startAt === 'modes' ? { kind: 'setup' } : { kind: startAt });
  const [facets, setFacets] = useState<QuestionFacet[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadFacets(questionStore).then(setFacets, (e: unknown) => setLoadError(msg(e)));
  }, []);

  const start = async (config: DrillConfig) => {
    if (!facets) return;
    await drillStore.getState().start(config, facets);
    if (drillStore.getState().session) setStep({ kind: 'play' });
  };

  const leaveFinished = useCallback(() => {
    drillStore.getState().closeFinished();
    onExit();
  }, [onExit]);

  if (loadError) return <Notice error>Could not read the question bank: {loadError}</Notice>;
  if (!facets) return <Notice>Loading...</Notice>;

  const banner = error && <Notice error>{error}</Notice>;

  switch (step.kind) {
    case 'setup':
      return (
        <div className="space-y-3">
          {banner}
          <DrillSetup taxonomy={buildTaxonomy(facets)} facets={facets} onStart={(c) => void start(c)} onCancel={onExit} onStarted={() => drillStore.getState().session && setStep({ kind: 'play' })} onRandom20={onRandom20} focusModes={startAt === 'modes'} />
        </div>
      );
    case 'skills':
      return <SkillsScreen facets={facets} onBack={step.back ? () => setStep(step.back as Step) : onExit} />;
    case 'past':
      return (
        <PastScreen
          facets={facets}
          onOpen={(sessionId) => setStep({ kind: 'report', sessionId, from: 'past' })}
          onOpenTest={onOpenTest}
          onResumed={() => {
            // An exam module resumes in the exam screen, not the drill one.
            if (drillStore.getState().session?.mode === 'exam' && onOpenExam) onOpenExam();
            else setStep({ kind: 'play' });
          }}
          onBack={onExit}
        />
      );
    case 'data':
      return <DataScreen onBack={onExit} />;
    case 'report':
      return (
        <ReportScreen
          sessionId={step.sessionId}
          backLabel={step.from === 'drill' ? 'Done' : 'Back to past drills'}
          onBack={step.from === 'drill' ? leaveFinished : () => setStep({ kind: 'past' })}
          onMySkills={() => setStep({ kind: 'skills', back: step })}
        />
      );
    case 'play':
      return <PlayScreen onExit={onExit} onFinished={(sessionId) => setStep({ kind: 'report', sessionId, from: 'drill' })} />;
  }
}

export function PlayScreen({ onExit, onFinished }: { onExit: () => void; onFinished: (sessionId: string) => void }) {
  const session = useDrill((s) => s.session);
  const questions = useDrill((s) => s.questions);
  const error = useDrill((s) => s.error);

  useEffect(() => {
    if (session?.status === 'finished') onFinished(session.id);
  }, [session?.status, session?.id, onFinished]);

  if (!session) return <Notice>No drill is running.</Notice>;
  if (session.status !== 'in_progress') return <Notice>Loading your report...</Notice>;
  const id = currentQuestionId(session);
  const question = id === null ? undefined : questions[id];
  if (id === null || !question) return <Notice error>This question is missing from the bank.</Notice>;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void drillStore.getState().retrySave()}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Retry
          </button>
        </div>
      )}
      {/* Keyed by question: a new visit starts a new focus timer. */}
      <PlayQuestion key={`${session.id}:${id}`} session={session} question={question} onExit={onExit} />
    </div>
  );
}

function PlayQuestion({ session, question, onExit }: { session: SessionRecord; question: Question; onExit: () => void }) {
  const saveError = useDrill((s) => s.saveError);
  const [navigating, setNavigating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const actions = drillStore.getState();
  const p = progressOf(session, question.id);

  const readTime = useFocusTimer({ baseMs: p.activeMs, active: true, onElapsed: (ms) => actions.saveElapsed(ms) });
  useAttentionTelemetry({ sessionId: session.id, mode: session.mode, questionId: question.id });

  useEffect(() => {
    drillStore.getState().shown();
    const onHide = () => drillStore.getState().unloading(readTime());
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [readTime]);

  const nav = async (fn: () => Promise<boolean>) => {
    setNavigating(true);
    try {
      return await fn();
    } finally {
      setNavigating(false);
    }
  };
  const last = session.index === session.queueIds.length - 1;
  const single = session.source === 'browse';
  const check = finishCheck(session);

  return (
    <>
      <DrillPlay
        question={question}
        index={session.index}
        total={session.queueIds.length}
        response={p.response}
        onSelect={(r) => actions.select(r)}
        struck={p.struck}
        onStrike={(l) => actions.strike(l)}
        flagged={p.flagged}
        onToggleFlag={() => actions.toggleFlag()}
        askConfidence={session.askConfidence}
        confidence={p.confidence}
        onRate={(r) => actions.rate(r)}
        onBack={() => void nav(() => actions.go('back', session.index - 1, readTime()))}
        onNext={() => {
          if (!last) {
            void nav(() => actions.go('next', session.index + 1, readTime()));
            return;
          }
          actions.finishClicked();
          // A single question with an answer has nothing to check: Done finishes it.
          if (single && p.response !== null) {
            void nav(() => actions.finish(readTime()));
            return;
          }
          setConfirming(true);
        }}
        finishLabel={single ? 'Done' : 'Finish'}
        // Each answer is saved in the background; navigation itself waits for the save, so the
        // buttons only show "Saving..." while a move is actually waiting.
        saving={navigating}
        saveError={saveError}
        onRetry={() => void actions.retrySave()}
        onExit={() => {
          void nav(() => actions.exit(readTime())).then((ok) => {
            if (ok) onExit();
          });
        }}
      />
      {confirming && (
        <FinishConfirm
          unanswered={check.unanswered}
          flagged={check.flagged}
          busy={navigating}
          onCancel={() => {
            actions.finishCancelled();
            setConfirming(false);
          }}
          onGoTo={(n) => {
            setConfirming(false);
            void nav(() => actions.go('jump', n - 1, readTime()));
          }}
          onConfirm={() => {
            void nav(() => actions.finish(readTime())).then((ok) => {
              if (!ok) setConfirming(false);
            });
          }}
        />
      )}
    </>
  );
}

export function ReportScreen(props: { sessionId: string; backLabel: string; onBack: () => void; onMySkills: () => void }) {
  const { sessionId } = props;
  const [report, setReport] = useState<SessionReport | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef<Map<string, number>>(new Map());
  const logged = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await attemptStore.getSession(sessionId);
      if (!s || s.status !== 'finished') throw new Error('This drill is not finished.');
      const [found, attempts] = await Promise.all([Promise.all(s.queueIds.map((id) => questionStore.get(id))), attemptStore.listAttempts(sessionId)]);
      const questions = new Map<string, Question>();
      for (const q of found) if (q) questions.set(q.id, q);
      if (!live) return;
      setSession(s);
      setReport(buildReport(s, questions, attempts));
      if (!logged.current) {
        logged.current = true;
        telemetry.log('report_opened', { sessionId: s.id, mode: s.mode, questionId: null }, {});
      }
    })().catch((e: unknown) => {
      if (live) setError(msg(e));
    });
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (error) return <Notice error>Could not open the report: {error}</Notice>;
  if (!report || !session) return <Notice>Loading...</Notice>;

  return (
    <DrillReport
      report={report}
      backLabel={props.backLabel}
      onBack={props.onBack}
      onMySkills={props.onMySkills}
      onItemToggle={(questionId, open) => {
        const ctx = { sessionId: session.id, mode: session.mode, questionId };
        if (open) {
          opened.current.set(questionId, performance.now());
          telemetry.log('rationale_viewed', ctx, {});
          return;
        }
        const since = opened.current.get(questionId);
        if (since === undefined) return;
        opened.current.delete(questionId);
        telemetry.log('report_item_time', ctx, { dwellMs: Math.round(performance.now() - since) });
      }}
    />
  );
}

function PastScreen(props: { facets: QuestionFacet[]; onOpen: (id: string) => void; onOpenTest?: (id: string) => void; onResumed: () => void; onBack: () => void }) {
  const { facets, onOpen, onBack } = props;
  const [rows, setRows] = useState<PastSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const loadHidden = useCallback(() => {
    hiddenSessionsStore.listHidden().then(
      (h) => setHidden(new Set(h.map((x) => x.sessionId))),
      (e: unknown) => setError(msg(e)),
    );
  }, []);
  useEffect(() => {
    attemptStore.listSessions({ status: 'finished' }).then(
      (sessions) => setRows(pastSessionRows(sessions, facets)),
      (e: unknown) => setError(msg(e)),
    );
    loadHidden();
  }, [facets, loadHidden]);
  if (error) return <Notice error>Could not read your past drills: {error}</Notice>;
  if (!rows) return <Notice>Loading...</Notice>;
  const open = (id: string) => (rows.find((r) => r.id === id)?.isTest && props.onOpenTest ? props.onOpenTest(id) : onOpen(id));
  const hiding = {
    hidden,
    showHidden,
    onShowHidden: setShowHidden,
    onSetHidden: (id: string, hide: boolean) => void hiddenSessionsStore.setHidden([id], hide).then(loadHidden, (e: unknown) => setError(msg(e))),
    onHideBefore: (before: number) => void hiddenSessionsStore.hideBefore(before).then(loadHidden, (e: unknown) => setError(msg(e))),
  };
  return <PastDrills rows={rows} onOpen={open} onBack={onBack} hiding={hiding} inProgressSlot={<InProgressSection onResumed={props.onResumed} onOpenTest={props.onOpenTest} />} />;
}

function DataScreen({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    telemetryStore.stats().then(
      (s) => {
        setStats(s);
        setStatsError(null);
      },
      (e: unknown) => setStatsError(`Could not read your data: ${msg(e)}`),
    );
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <DataPage
      stats={stats}
      statsError={statsError}
      onBack={onBack}
      onExport={async () => {
        await telemetry.flush();
        const data = await telemetryStore.exportAll();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackbook-data-${data.exportedAt.slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }}
      onDeleteTelemetry={async () => {
        await telemetry.flush();
        await telemetryStore.clearEvents();
        refresh();
      }}
      onDeleteAll={async () => {
        await attemptStore.clearAll();
        await drillStore.getState().init();
        refresh();
      }}
    />
  );
}

function SkillsScreen({ facets, onBack }: { facets: QuestionFacet[]; onBack: () => void }) {
  const [data, setData] = useState<{ rows: SkillStatRow[]; unattributed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([attemptStore.listAttempts(), attemptStore.listSessions()]).then(
      ([attempts, sessions]) => setData(computeSkillStats(countableAttempts(attempts, sessions, 'drill'), facets)),
      (e: unknown) => setError(msg(e)),
    );
  }, [facets]);
  if (error) return <Notice error>Could not read your attempts: {error}</Notice>;
  if (!data) return <Notice>Loading...</Notice>;
  return <MySkills rows={data.rows} unattributed={data.unattributed} onBack={onBack} />;
}
