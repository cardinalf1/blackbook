import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usedMs } from '../../services/exam/timer';
import { buildReport } from '../../services/session/report';
import { attemptStore, questionStore } from '../../services/storage';
import { telemetry } from '../../services/telemetry';
import { drillStore, useDrill } from '../../stores/drillStore';
import type { AssembledModule } from '../../types/exam';
import type { Question } from '../../types/sat';
import type { SessionRecord, SessionReport } from '../../types/session';
import { moduleTitle, TestRoomPlay } from '../testroom/TestRoom';
import { ExamResults } from './ExamResults';
import { ExamSetup } from './ExamSetup';

export { moduleTitle };

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

/** The timed module: the Phase 9 test room. */
export const ExamPlay = TestRoomPlay;

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
