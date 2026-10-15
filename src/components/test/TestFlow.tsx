import { useCallback, useEffect, useRef, useState } from 'react';
import { loadRows } from '../../services/browse/rows';
import { loadPoolHealth, type PoolHealthView } from '../../services/retry/load';
import { moduleDurationMs } from '../../services/test/devOverrides';
import { breakRemainingMs, currentSlot, currentStep, routeOf } from '../../services/test/flow';
import { preflightTest } from '../../services/test/preflight';
import { moduleTitle } from '../../services/test/report';
import { telemetry } from '../../services/telemetry';
import { drillStore, useDrill } from '../../stores/drillStore';
import { testStore, useTest } from '../../stores/testStore';
import type { BrowseRow } from '../../types/browse';
import type { TestKind, TestPreflight, TestReport } from '../../types/test';
import { ExamPlay } from '../exam/ExamFlow';
import { BreakScreen } from './BreakScreen';
import { ModuleReady } from './ModuleReady';
import { TestReportView } from './TestReportView';
import { TestSetup } from './TestSetup';

/** Redraw rate of the break countdown. The time shown is always recomputed from the saved deadline. */
const REDRAW_MS = 250;

const card = 'rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400';

interface Props {
  /** 'setup' starts a new test; 'open' continues or reopens the test given by `testId`. */
  startAt: 'setup' | 'open';
  testId?: string;
  onExit: () => void;
  onMySkills: () => void;
}

/**
 * Setup, the four modules, the break and the final report of a full practice test or a section run.
 * Everything that decides what comes next lives in the test store; this component only shows the
 * step the saved test is on.
 */
export function TestFlow({ startAt, testId, onExit, onMySkills }: Props) {
  const record = useTest((s) => s.record);
  const busy = useTest((s) => s.busy);
  const error = useTest((s) => s.error);
  const [opening, setOpening] = useState(startAt === 'open');

  useEffect(() => {
    if (startAt !== 'open' || !testId) return;
    let live = true;
    void testStore
      .getState()
      .open(testId)
      .then(() => {
        if (live) setOpening(false);
      });
    return () => {
      live = false;
    };
  }, [startAt, testId]);

  // A fresh visit to the setup page must not show an earlier test.
  useEffect(() => {
    if (startAt === 'setup') testStore.getState().close();
  }, [startAt]);

  const leave = useCallback(() => {
    drillStore.getState().closeFinished();
    testStore.getState().close();
    onExit();
  }, [onExit]);

  if (opening) return <div className={card}>Opening your test...</div>;
  if (!record?.test) {
    return (
      <>
        {error && startAt === 'open' && (
          <div className="mb-3 rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
            {error}
          </div>
        )}
        <SetupStep busy={busy} error={error} onCancel={onExit} />
      </>
    );
  }
  if (record.status === 'finished') return <FinishedStep onBack={leave} onMySkills={() => {
    testStore.getState().close();
    onMySkills();
  }} />;
  if (record.status !== 'in_progress') return <div className={card}>This test was discarded.</div>;
  return <RunningStep onLeave={leave} />;
}

function SetupStep({ busy, error, onCancel }: { busy: boolean; error: string | null; onCancel: () => void }) {
  const [kind, setKind] = useState<TestKind>('full');
  const [includeSeen, setIncludeSeen] = useState(false);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [poolHealth, setPoolHealth] = useState<PoolHealthView | null>(null);
  const [rows, setRows] = useState<BrowseRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadRows().then(setRows, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    loadPoolHealth().then(setPoolHealth, () => undefined);
  }, []);

  // Checked again only when the format changes, so "Start" shows what will really be built.
  const [preflight, setPreflight] = useState<TestPreflight | null>(null);
  useEffect(() => {
    setPreflight(rows ? preflightTest(rows, kind) : null);
  }, [rows, kind]);

  return (
    <TestSetup
      kind={kind}
      onKindChange={setKind}
      preflight={preflight}
      includeSeen={includeSeen}
      onIncludeSeenChange={setIncludeSeen}
      allowRepeats={allowRepeats}
      onAllowRepeatsChange={setAllowRepeats}
      poolHealth={poolHealth}
      busy={busy}
      error={loadError ?? error}
      onStart={() => void testStore.getState().start(kind, includeSeen, allowRepeats)}
      onCancel={onCancel}
    />
  );
}

function RunningStep({ onLeave }: { onLeave: () => void }) {
  const record = useTest((s) => s.record);
  const busy = useTest((s) => s.busy);
  const error = useTest((s) => s.error);
  const drillSession = useDrill((s) => s.session);
  const test = record?.test;

  // A module of this test finished on screen (submitted by you or the timer): move the test on.
  const finishedId = drillSession?.exam?.testId === record?.id && drillSession?.status === 'finished' ? drillSession?.id : null;
  useEffect(() => {
    if (finishedId === null) return;
    drillStore.getState().closeFinished();
    void testStore.getState().reconcile();
  }, [finishedId]);

  if (!record || !test) return null;
  const step = currentStep(test);
  const playing = drillSession?.mode === 'exam' && drillSession.exam?.testId === record.id && drillSession.status === 'in_progress';

  if (playing) return <ExamPlay onExit={onLeave} />;
  if (finishedId !== null) return <div className={card}>Saving your module...</div>;
  if (step?.type === 'break') return <BreakStep />;
  const slot = currentSlot(test);
  if (!slot) return <div className={card}>Updating your test...</div>;

  const route = routeOf(test, slot.section);
  const routeNote = slot.moduleNumber === 2 && route ? `Routed to the ${route} Module 2 based on how Module 1 went.` : null;
  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400" role="alert">
          {error}
        </div>
      )}
      <ModuleReady
        title={moduleTitle(slot.section, slot.moduleNumber)}
        questionCount={slot.questionIds.length}
        timeLimitMs={moduleDurationMs(slot.section)}
        routeNote={routeNote}
        resuming={slot.sessionId !== null}
        notes={slot.notes}
        busy={busy}
        onStart={() => void testStore.getState().startModule()}
        onLeave={onLeave}
      />
    </div>
  );
}

/** The break: counts down from the saved deadline and ends by itself at zero. */
function BreakStep() {
  const record = useTest((s) => s.record);
  const busy = useTest((s) => s.busy);
  const br = record?.test?.break ?? null;
  const [now, setNow] = useState(() => Date.now());
  const ended = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), REDRAW_MS);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const remaining = br ? breakRemainingMs(br, now) : 0;
  useEffect(() => {
    if (!br || remaining > 0 || ended.current) return;
    ended.current = true;
    void testStore.getState().reconcile();
  }, [br, remaining]);

  const test = record?.test;
  if (!test || !br) return <div className={card}>Updating your test...</div>;
  const next = test.steps.slice(test.stepIndex + 1).find((s) => s.type === 'module');
  const slot = next?.type === 'module' ? test.slots[next.key] : undefined;
  return (
    <BreakScreen
      remainingMs={remaining}
      durationMs={br.durationMs}
      nextTitle={slot ? moduleTitle(slot.section, slot.moduleNumber) : 'Results'}
      busy={busy}
      onEnd={() => void testStore.getState().endBreak(true)}
    />
  );
}

function FinishedStep({ onBack, onMySkills }: { onBack: () => void; onMySkills: () => void }) {
  const record = useTest((s) => s.record);
  const [report, setReport] = useState<TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(new Map<string, number>());
  const logged = useRef(false);

  useEffect(() => {
    let live = true;
    testStore
      .getState()
      .report()
      .then(
        (r) => {
          if (!live) return;
          if (!r) setError('This test has no report yet.');
          else setReport(r);
          if (r && record && !logged.current) {
            logged.current = true;
            telemetry.log('report_opened', { sessionId: record.id, mode: 'exam', questionId: null }, {});
          }
        },
        (e: unknown) => {
          if (live) setError(e instanceof Error ? e.message : String(e));
        },
      );
    return () => {
      live = false;
    };
  }, [record]);

  const onItemToggle = useCallback(
    (questionId: string, open: boolean) => {
      if (!record) return;
      const ctx = { sessionId: record.id, mode: record.mode, questionId };
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
    [record],
  );

  if (error) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not open the results: {error}</div>;
  if (!report) return <div className={card}>Loading...</div>;
  return <TestReportView report={report} onItemToggle={onItemToggle} onBack={onBack} onMySkills={onMySkills} />;
}
