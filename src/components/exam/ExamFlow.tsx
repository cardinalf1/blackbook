import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAUSE_REASONS } from '../../config/examConfig';
import { useAttentionTelemetry } from '../../hooks/useAttentionTelemetry';
import { useExamClock } from '../../hooks/useExamClock';
import { useFocusTimer } from '../../hooks/useFocusTimer';
import { isPaused, remainingMs, usedMs } from '../../services/exam/timer';
import { currentQuestionId, finishCheck, progressOf } from '../../services/session/record';
import { buildReport } from '../../services/session/report';
import { attemptStore, questionStore } from '../../services/storage';
import { telemetry } from '../../services/telemetry';
import { drillStore, useDrill } from '../../stores/drillStore';
import type { AssembledModule, ExamState, NavigatorItem } from '../../types/exam';
import type { Question } from '../../types/sat';
import type { SessionRecord, SessionReport } from '../../types/session';
import { ExamBottomBar } from './ExamBottomBar';
import { ExamHeader } from './ExamHeader';
import { ExamResults } from './ExamResults';
import { ExamReview } from './ExamReview';
import { ExamSetup } from './ExamSetup';
import { FiveMinuteAlert } from './FiveMinuteAlert';
import { MathPane } from './MathPane';
import { NavigatorDrawer } from './NavigatorDrawer';
import { PauseDialog } from './PauseDialog';
import { ReferenceSheet } from './ReferenceSheet';
import { RwSplitPane } from './RwSplitPane';

const SECTION_LABEL = { rw: 'Reading and Writing', math: 'Math' } as const;

export function moduleTitle(e: ExamState): string {
  const section = e.module.section === 'rw' ? 1 : 2;
  return `Section ${section}, Module ${e.module.moduleNumber}: ${SECTION_LABEL[e.module.section]}`;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Step = { kind: 'setup' } | { kind: 'play' } | { kind: 'results'; sessionId: string };

/** Setup, the timed module, the review page and the results. Session state lives in the store. */
export function ExamFlow({ startAt, onExit, onMySkills }: { startAt: 'setup' | 'play'; onExit: () => void; onMySkills: () => void }) {
  const [step, setStep] = useState<Step>({ kind: startAt });
  const error = useDrill((s) => s.error);
  const session = useDrill((s) => s.session);

  // A module submitted while open (by you or the timer, also right after resuming) shows its results.
  useEffect(() => {
    if (step.kind === 'play' && session?.mode === 'exam' && session.status === 'finished') setStep({ kind: 'results', sessionId: session.id });
  }, [step.kind, session?.mode, session?.status, session?.id]);

  const start = async (m: AssembledModule, durationMs: number) => {
    await drillStore.getState().startExam(m.spec, m.questionIds, durationMs, m.notes);
    if (drillStore.getState().session?.mode === 'exam') setStep({ kind: 'play' });
  };

  const leave = () => {
    drillStore.getState().closeFinished();
    onExit();
  };

  return (
    <div className="space-y-3">
      {error && step.kind !== 'play' && (
        <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          {error}
        </div>
      )}
      {step.kind === 'setup' && <ExamSetup onStart={(m, d) => void start(m, d)} onCancel={onExit} />}
      {step.kind === 'play' && <ExamPlay onExit={onExit} />}
      {step.kind === 'results' && (
        <ExamResultsScreen
          sessionId={step.sessionId}
          onBack={leave}
          onMySkills={() => {
            drillStore.getState().closeFinished();
            onMySkills();
          }}
        />
      )}
    </div>
  );
}

function ExamPlay({ onExit }: { onExit: () => void }) {
  const session = useDrill((s) => s.session);
  const questions = useDrill((s) => s.questions);
  const saveError = useDrill((s) => s.saveError);
  const storeError = useDrill((s) => s.error);
  const [alertOpen, setAlertOpen] = useState(false);
  const [pauseMode, setPauseMode] = useState<'closed' | 'confirm'>('closed');
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const readTimeRef = useRef<() => number>(() => 0);

  const exam = session?.exam;
  const actions = drillStore.getState();
  const left = useExamClock(exam, {
    // Time is up: submit with whatever is answered, skipping the review page.
    onExpire: () => void drillStore.getState().submitExam('timer', readTimeRef.current()),
    onFiveMinutes: () => {
      drillStore.getState().fiveMinuteAlertShown();
      setAlertOpen(true);
    },
  });

  if (!session || !exam) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">No module is open.</div>;
  if (session.status !== 'in_progress') {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400" role="status">
        {exam.submittedBy === 'timer' ? 'Time is up. Submitting your module...' : 'Submitting...'}
      </div>
    );
  }

  const paused = isPaused(exam.timer);
  const items: NavigatorItem[] = session.queueIds.map((id, i) => ({
    number: i + 1,
    answered: progressOf(session, id).response !== null,
    flagged: progressOf(session, id).flagged,
  }));
  const title = moduleTitle(exam);
  const nav = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };

  const banner = (saveError || storeError) && (
    <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-[#121215] p-3 text-sm text-red-400" role="alert">
      <span className="min-w-0 flex-1">{saveError ?? storeError}</span>
      <button
        type="button"
        onClick={() => void actions.retrySave()}
        className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0A0A0C] text-[#FAFAFA]">
      <ExamHeader
        title={title}
        remainingMs={left}
        timerHidden={exam.timerHidden}
        onToggleTimer={() => actions.toggleTimer()}
        paused={paused}
        onPauseClick={() => setPauseMode('confirm')}
        onOpenReference={
          exam.module.section === 'math'
            ? () => {
                actions.note('reference_opened');
                setReferenceOpen(true);
              }
            : undefined
        }
      />
      {banner}
      <div className="min-h-0 flex-1 pb-16">
        {paused ? null : exam.phase === 'review' ? (
          <div className="h-full overflow-y-auto p-6">
            <ExamReview
              title={title}
              items={items}
              remainingMs={left}
              busy={busy}
              onJump={(i) => actions.closeReview(i)}
              onSubmit={() => {
                actions.finishClicked();
                void nav(() => actions.submitExam('user', 0));
              }}
            />
          </div>
        ) : (
          <ExamQuestion
            key={`${session.id}:${currentQuestionId(session)}:${exam.pauses.length}`}
            session={session}
            questions={questions}
            readTimeRef={readTimeRef}
            disabled={busy || saveError !== null}
            onBack={() => void nav(() => actions.go('back', session.index - 1, readTimeRef.current()))}
            onNext={() => {
              if (session.index === session.queueIds.length - 1) actions.openReview(readTimeRef.current());
              else void nav(() => actions.go('next', session.index + 1, readTimeRef.current()));
            }}
          />
        )}
      </div>
      {exam.phase === 'in_progress' && !paused && (
        <ExamBottomBar
          index={session.index}
          total={session.queueIds.length}
          disabled={busy || saveError !== null}
          onBack={() => void nav(() => actions.go('back', session.index - 1, readTimeRef.current()))}
          onNext={() => {
            if (session.index === session.queueIds.length - 1) actions.openReview(readTimeRef.current());
            else void nav(() => actions.go('next', session.index + 1, readTimeRef.current()));
          }}
          onOpenNavigator={() => {
            actions.note('navigator_opened');
            setNavigatorOpen(true);
          }}
        />
      )}
      {navigatorOpen && exam.phase === 'in_progress' && (
        <NavigatorDrawer
          items={items}
          currentIndex={session.index}
          onClose={() => {
            actions.note('navigator_closed');
            setNavigatorOpen(false);
          }}
          onJump={(i) => {
            actions.note('navigator_closed');
            setNavigatorOpen(false);
            if (i !== session.index) void nav(() => actions.go('jump', i, readTimeRef.current()));
          }}
          onGoToReview={() => {
            actions.note('navigator_closed');
            setNavigatorOpen(false);
            actions.openReview(readTimeRef.current());
          }}
        />
      )}
      {referenceOpen && (
        <ReferenceSheet
          onClose={() => {
            actions.note('reference_closed');
            setReferenceOpen(false);
          }}
        />
      )}
      {alertOpen && <FiveMinuteAlert onDismiss={() => setAlertOpen(false)} />}
      {(pauseMode === 'confirm' || paused) && (
        <PauseDialog
          mode={paused ? 'paused' : 'confirm'}
          reasons={PAUSE_REASONS}
          remainingMs={remainingMs(exam.timer, Date.now())}
          onConfirm={(reason) => {
            setPauseMode('closed');
            actions.pauseExam(reason, readTimeRef.current());
          }}
          onCancel={() => setPauseMode('closed')}
          onResume={() => actions.resumeExam()}
        />
      )}
      {!paused && (
        <button
          type="button"
          onClick={() => {
            void actions.exit(readTimeRef.current()).then((ok) => {
              if (ok) onExit();
            });
          }}
          className="fixed bottom-5 left-4 z-40 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Leave (the clock keeps running)
        </button>
      )}
    </div>
  );
}

/** One question on screen: its focus timer, telemetry, arrow keys, and the right pane. */
function ExamQuestion(props: {
  session: SessionRecord;
  questions: Record<string, Question>;
  readTimeRef: { current: () => number };
  disabled: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const { session, questions, readTimeRef } = props;
  const id = currentQuestionId(session);
  const question = id === null ? undefined : questions[id];
  const p = progressOf(session, id ?? '');
  const actions = drillStore.getState();
  const readTime = useFocusTimer({ baseMs: p.activeMs, active: true, onElapsed: (ms) => actions.saveElapsed(ms) });
  readTimeRef.current = readTime;
  useAttentionTelemetry({ sessionId: session.id, mode: session.mode, questionId: id });

  useEffect(() => {
    drillStore.getState().shown();
    const onHide = () => drillStore.getState().unloading(readTime());
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [readTime]);

  // Arrow keys move, except while typing in a field or with a dialog open.
  const { onBack, onNext, disabled } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      if (e.key === 'ArrowLeft' && session.index > 0) {
        e.preventDefault();
        onBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onBack, onNext, session.index]);

  if (!question || id === null) {
    return <div className="p-6 text-sm text-red-400" role="alert">This question is missing from the bank.</div>;
  }
  const paneProps = {
    question,
    number: session.index + 1,
    response: p.response,
    onSelect: (r: string) => actions.select(r),
    struck: p.struck,
    onStrike: (l: Parameters<typeof actions.strike>[0]) => actions.strike(l),
    flagged: p.flagged,
    onToggleFlag: () => actions.toggleFlag(),
  };
  return session.exam?.module.section === 'math' ? <MathPane {...paneProps} /> : <RwSplitPane {...paneProps} />;
}

function ExamResultsScreen({ sessionId, onBack, onMySkills }: { sessionId: string; onBack: () => void; onMySkills: () => void }) {
  const [data, setData] = useState<{ session: SessionRecord; report: SessionReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(new Map<string, number>());
  const logged = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await attemptStore.getSession(sessionId);
      if (!s || s.status !== 'finished' || !s.exam) throw new Error('This module is not submitted.');
      const [found, attempts] = await Promise.all([Promise.all(s.queueIds.map((id) => questionStore.get(id))), attemptStore.listAttempts(sessionId)]);
      const qs = new Map<string, Question>();
      for (const q of found) if (q) qs.set(q.id, q);
      if (!live) return;
      setData({ session: s, report: buildReport(s, qs, attempts) });
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

  const onItemToggle = useCallback(
    (questionId: string, open: boolean) => {
      if (!data) return;
      const ctx = { sessionId: data.session.id, mode: data.session.mode, questionId };
      if (open) {
        opened.current.set(questionId, performance.now());
        telemetry.log('rationale_viewed', ctx, {});
        return;
      }
      const since = opened.current.get(questionId);
      if (since === undefined) return;
      opened.current.delete(questionId);
      telemetry.log('report_item_time', ctx, { dwellMs: Math.round(performance.now() - since) });
    },
    [data],
  );

  const exam = data?.session.exam;
  const timeUsedMs = useMemo(() => (exam ? usedMs(exam.timer, data?.session.finishedAt ?? Date.now()) : 0), [exam, data?.session.finishedAt]);

  if (error) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not open the results: {error}</div>;
  if (!data || !exam) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">Loading...</div>;

  return (
    <ExamResults
      title={moduleTitle(exam)}
      report={data.report}
      submittedBy={exam.submittedBy ?? 'user'}
      pauses={exam.pauses}
      timeUsedMs={timeUsedMs}
      timeLimitMs={exam.timer.durationMs}
      onItemToggle={onItemToggle}
      onBack={onBack}
      onMySkills={onMySkills}
    />
  );
}
