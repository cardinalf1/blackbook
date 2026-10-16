// The exam test room (Phase 9): header with Directions, timer and tools; the two panes; the
// question bar; the footer with the question menu; the review screen; the floating calculator, the
// docked reference sheet, highlights, the line reader, zoom and the More menu. Layout and behavior
// follow the real test (docs/bluebook-ui-spec.md); the look is Blackbook's own.
//
// Timers, routing, persistence and the event logger are unchanged: this file only calls the drill
// store's existing exam actions, plus `setAnnotations` and `toolEvent`.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PAUSE_REASONS } from '../../config/examConfig';
import { LINE_READER_LINES, toolsFor } from '../../config/testRoomConfig';
import { useAttentionTelemetry } from '../../hooks/useAttentionTelemetry';
import { useExamClock } from '../../hooks/useExamClock';
import { useFocusTimer } from '../../hooks/useFocusTimer';
import { useCalculatorEngine } from '../../services/calculator/engine';
import { isPaused, remainingMs } from '../../services/exam/timer';
import { currentQuestionId, progressOf } from '../../services/session/record';
import { drillStore, useDrill } from '../../stores/drillStore';
import { testRoomStore, useTestRoom, zoomPercent } from '../../stores/testRoomStore';
import type { ExamState, NavigatorItem } from '../../types/exam';
import type { Question, Section } from '../../types/sat';
import type { SessionRecord } from '../../types/session';
import type { HeaderTool, MoreMenuItem, ToolId } from '../../types/testRoom';
import { ChoiceList } from '../exam/ChoiceList';
import { FiveMinuteAlert } from '../exam/FiveMinuteAlert';
import { PauseDialog } from '../exam/PauseDialog';
import { SprInput } from '../exam/SprInput';
import { AnnotatedHtml, HIGHLIGHT_SELECTION_EVENT } from './AnnotatedHtml';
import { CalculatorPanel } from './CalculatorPanel';
import { ContentHtml } from './ContentHtml';
import { DirectionsPanel } from './DirectionsPanel';
import { InfoDialog } from './InfoDialog';
import { LineReader } from './LineReader';
import { QuestionBar } from './QuestionBar';
import { QuestionMenu } from './QuestionMenu';
import { ReferencePanel } from './ReferencePanel';
import { ReviewScreen } from './ReviewScreen';
import { SplitPanes } from './SplitPanes';
import { SprDirections } from './SprDirections';
import { TestRoomFooter } from './TestRoomFooter';
import { TestRoomHeader } from './TestRoomHeader';
import { UnscheduledBreak } from './UnscheduledBreak';

const SECTION_LABEL = { rw: 'Reading and Writing', math: 'Math' } as const;

export function moduleTitle(e: ExamState): string {
  const section = e.module.section === 'rw' ? 1 : 2;
  return `Section ${section}, Module ${e.module.moduleNumber}: ${SECTION_LABEL[e.module.section]}`;
}

/** Our own list of keyboard shortcuts (the More menu's Shortcuts dialog). */
export const SHORTCUTS: readonly [string, string][] = [
  ['Left arrow / Right arrow', 'Back / Next (when not typing)'],
  ['Ctrl + plus / Ctrl + minus', 'Zoom the test in / out'],
  ['Ctrl + 0', 'Reset the zoom'],
  ['Escape', 'Close a menu, panel or dialog'],
];

/** The header tools for a section, in the real test's order. */
export function headerTools(section: Section): ToolId[] {
  return toolsFor(section, 'mcq').filter((t) => t === 'calculator' || t === 'reference' || t === 'highlights');
}

/** Ctrl +, Ctrl - and Ctrl 0 zoom the test content. */
function useZoomKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const step = e.key === '=' || e.key === '+' ? 1 : e.key === '-' ? -1 : e.key === '0' ? 0 : null;
      if (step === null) return;
      e.preventDefault();
      testRoomStore.getState().zoom(step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function TestRoomPlay({ onExit }: { onExit: () => void }) {
  const session = useDrill((s) => s.session);
  const questions = useDrill((s) => s.questions);
  const saveError = useDrill((s) => s.saveError);
  const storeError = useDrill((s) => s.error);
  const room = useTestRoom((s) => s);
  const [alertOpen, setAlertOpen] = useState(false);
  const [pauseMode, setPauseMode] = useState<'closed' | 'confirm'>('closed');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readTimeRef = useRef<() => number>(() => 0);
  const engine = useCalculatorEngine();
  useZoomKeys();

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

  const sessionId = session?.id;
  useEffect(() => {
    if (sessionId) testRoomStore.getState().enterScope(sessionId);
  }, [sessionId]);

  // The review screen was reached (from the last Next or the question menu).
  const phase = exam?.phase;
  useEffect(() => {
    if (phase !== 'review' || !session) return;
    const items = session.queueIds.map((id) => progressOf(session, id));
    actions.toolEvent('review_screen_reached', { unanswered: items.filter((p) => p.response === null).length, flagged: items.filter((p) => p.flagged).length }, null);
    // Only when the phase changes.
  }, [phase]);

  useEffect(() => {
    if (hint === null) return;
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
  }, [hint]);

  if (!session || !exam) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">No module is open.</div>;
  if (session.status !== 'in_progress') {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400" role="status">
        {exam.submittedBy === 'timer' ? 'Time is up. Submitting your module...' : 'Submitting...'}
      </div>
    );
  }

  const section = exam.module.section;
  const paused = isPaused(exam.timer);
  const onBreak = room.breakStartedAt !== null;
  const items: NavigatorItem[] = session.queueIds.map((id, i) => ({
    number: i + 1,
    answered: progressOf(session, id).response !== null,
    flagged: progressOf(session, id).flagged,
  }));
  const title = moduleTitle(exam);
  const questionId = currentQuestionId(session);
  const disabled = busy || saveError !== null;
  const nav = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  const back = () => void nav(() => actions.go('back', session.index - 1, readTimeRef.current()));
  const next = () => {
    if (session.index === session.queueIds.length - 1) actions.openReview(readTimeRef.current());
    else void nav(() => actions.go('next', session.index + 1, readTimeRef.current()));
  };
  const leave = () => {
    void actions.exit(readTimeRef.current()).then((ok) => {
      if (ok) onExit();
    });
  };

  const toolButton: Record<HeaderTool['id'], HeaderTool> = {
    calculator: { id: 'calculator', label: 'Calculator', active: room.calculatorOpen, onClick: () => testRoomStore.getState().toggleCalculator(questionId) },
    reference: { id: 'reference', label: 'Reference', active: room.referenceOpen, onClick: () => testRoomStore.getState().toggleReference() },
    highlights: {
      id: 'highlights',
      label: 'Highlights & Notes',
      active: false,
      onClick: () => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) setHint('Select text in the passage or the question, then choose a color.');
        else window.dispatchEvent(new Event(HIGHLIGHT_SELECTION_EVENT));
      },
    },
  };
  const tools = headerTools(section).map((id) => toolButton[id as HeaderTool['id']]);

  const moreItems: MoreMenuItem[] = [
    { id: 'help', label: 'Help', onSelect: () => testRoomStore.getState().openDialog('help') },
    { id: 'shortcuts', label: 'Shortcuts', onSelect: () => testRoomStore.getState().openDialog('shortcuts') },
    ...(toolsFor(section, 'mcq').includes('lineReader')
      ? [{ id: 'lineReader' as const, label: 'Line Reader', active: room.lineReaderOn, onSelect: () => testRoomStore.getState().toggleLineReader() }]
      : []),
    { id: 'unscheduledBreak', label: 'Unscheduled Break', onSelect: () => testRoomStore.getState().startBreak() },
    { id: 'pause', label: 'Emergency pause (Blackbook only)', onSelect: () => (testRoomStore.getState().closeMore(), setPauseMode('confirm')) },
    { id: 'exit', label: 'Exit (the clock keeps running)', onSelect: leave },
  ];

  const banner = (saveError || storeError) && (
    <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center gap-3 rounded-[2px] border border-red-900/50 bg-black p-3 text-sm text-red-400" role="alert">
      <span className="min-w-0 flex-1">{saveError ?? storeError}</span>
      <button
        type="button"
        onClick={() => void actions.retrySave()}
        className="rounded-[2px] bg-white px-3 py-1 text-xs font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        Retry
      </button>
    </div>
  );

  const showQuestion = !paused && !onBreak && exam.phase === 'in_progress';

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0A0A0C] text-[#FAFAFA]">
      <TestRoomHeader
        sectionTitle={title}
        section={section}
        directionsOpen={room.directionsOpen}
        onToggleDirections={() => testRoomStore.getState().toggleDirections()}
        remainingMs={left}
        timerHidden={exam.timerHidden}
        onToggleTimer={() => actions.toggleTimer()}
        paused={paused}
        tools={exam.phase === 'in_progress' ? tools : []}
        moreOpen={room.moreOpen}
        onToggleMore={() => testRoomStore.getState().toggleMore()}
        moreItems={moreItems}
        zoomPercent={zoomPercent(room)}
      />
      {room.directionsOpen && <DirectionsPanel section={section} onClose={() => testRoomStore.getState().toggleDirections()} />}
      {banner}
      {hint && (
        <div className="mx-auto mt-2 rounded-[2px] border border-[#27272A] bg-black px-3 py-2 text-xs text-zinc-300" role="status">
          {hint}
        </div>
      )}
      <div className="min-h-0 flex-1" style={{ zoom: zoomPercent(room) / 100 }}>
        {paused ? null : exam.phase === 'review' ? (
          <div className="h-full overflow-y-auto p-6">
            <ReviewScreen
              title={title}
              items={items}
              busy={busy}
              onJump={(i) => actions.closeReview(i)}
              onSubmit={() => {
                actions.toolEvent(
                  'review_screen_submitted',
                  { unanswered: items.filter((i) => !i.answered).length, flagged: items.filter((i) => i.flagged).length },
                  null,
                );
                actions.finishClicked();
                void nav(() => actions.submitExam('user', 0));
              }}
            />
          </div>
        ) : (
          <TestRoomQuestion
            key={`${session.id}:${questionId}:${exam.pauses.length}`}
            session={session}
            questions={questions}
            readTimeRef={readTimeRef}
            disabled={disabled}
            onBack={back}
            onNext={next}
            side={
              section === 'math' && room.referenceOpen ? (
                <div className={room.referenceExpanded ? 'h-full w-[50vw]' : 'h-full w-[28rem] max-w-[45vw]'}>
                  <ReferencePanel
                    expanded={room.referenceExpanded}
                    onToggleExpand={() => testRoomStore.getState().toggleReferenceExpanded()}
                    onClose={() => testRoomStore.getState().toggleReference()}
                  />
                </div>
              ) : null
            }
          />
        )}
      </div>
      {exam.phase === 'in_progress' && !paused && !onBreak && (
        <TestRoomFooter
          label={`${SECTION_LABEL[section]}, Module ${exam.module.moduleNumber}`}
          index={session.index}
          total={session.queueIds.length}
          menuOpen={room.menuOpen}
          onToggleMenu={() => testRoomStore.getState().toggleMenu()}
          onBack={back}
          onNext={next}
          disabled={disabled}
        />
      )}
      {room.menuOpen && exam.phase === 'in_progress' && !paused && !onBreak && (
        <QuestionMenu
          title={`${title} Questions`}
          items={items}
          currentIndex={session.index}
          onClose={() => testRoomStore.getState().toggleMenu(false)}
          onJump={(i) => {
            testRoomStore.getState().toggleMenu(false);
            if (i !== session.index) void nav(() => actions.go('jump', i, readTimeRef.current()));
          }}
          onGoToReview={() => {
            testRoomStore.getState().toggleMenu(false);
            actions.openReview(readTimeRef.current());
          }}
        />
      )}
      {showQuestion && section === 'math' && room.calculatorOpen && (
        <CalculatorPanel
          mode={room.calculatorMode}
          onModeChange={(m) => testRoomStore.getState().setCalculatorMode(m)}
          rect={room.calculatorRect}
          onRectChange={(r) => testRoomStore.getState().setCalculatorRect(r)}
          onClose={() => testRoomStore.getState().toggleCalculator(questionId)}
          engine={engine}
          engineState={room.calculatorStates[room.calculatorMode] ?? null}
          onEngineStateChange={(m, st) => testRoomStore.getState().saveCalculatorState(m, st)}
        />
      )}
      {showQuestion && section === 'rw' && room.lineReaderOn && <LineReader lines={LINE_READER_LINES} onClose={() => testRoomStore.getState().toggleLineReader()} />}
      {onBreak && !paused && <UnscheduledBreak remainingMs={left} onResume={() => testRoomStore.getState().endBreak()} />}
      {room.dialog === 'help' && (
        <InfoDialog title="Help" onClose={() => testRoomStore.getState().closeDialog()}>
          <HelpText section={section} />
        </InfoDialog>
      )}
      {room.dialog === 'shortcuts' && (
        <InfoDialog title="Shortcuts" onClose={() => testRoomStore.getState().closeDialog()}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-zinc-300">{k}</dt>
                <dd className="text-zinc-400">{v}</dd>
              </div>
            ))}
          </dl>
        </InfoDialog>
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
    </div>
  );
}

function HelpText({ section }: { section: Section }) {
  return (
    <div className="space-y-2 text-sm text-zinc-300">
      <p>Answer each question, then press Next. Back and the question menu at the bottom take you to any question in this module until you submit it.</p>
      <p>Mark for Review puts a marker on the question so you can find it again in the question menu and on the review page.</p>
      {section === 'math' ? (
        <p>Calculator and Reference are at the top right. The cross-out button on a question lets you rule out answer choices.</p>
      ) : (
        <p>Select text in the passage or question to highlight it, underline it or add a note. The line reader in More shows a few lines at a time.</p>
      )}
      <p>The clock keeps running during an unscheduled break and if you exit. Emergency pause is a Blackbook feature, not part of the real test, and marks the result as paused.</p>
    </div>
  );
}

/** One question on screen: its focus timer, telemetry, arrow keys, and the panes. */
function TestRoomQuestion(props: {
  session: SessionRecord;
  questions: Record<string, Question>;
  readTimeRef: { current: () => number };
  disabled: boolean;
  onBack: () => void;
  onNext: () => void;
  side: ReactNode | null;
}) {
  const { session, questions, readTimeRef } = props;
  const id = currentQuestionId(session);
  const question = id === null ? undefined : questions[id];
  const p = progressOf(session, id ?? '');
  const actions = drillStore.getState();
  const eliminatorOn = useTestRoom((s) => s.eliminatorOn);
  const splitFraction = useTestRoom((s) => s.splitFraction);
  // The question stays mounted under an unscheduled break; its active time stops counting.
  const onBreak = useTestRoom((s) => s.breakStartedAt !== null);
  const readTime = useFocusTimer({ baseMs: p.activeMs, active: !onBreak, onElapsed: (ms) => actions.saveElapsed(ms) });
  readTimeRef.current = readTime;
  useAttentionTelemetry({ sessionId: session.id, mode: session.mode, questionId: id });

  useEffect(() => {
    drillStore.getState().shown();
    const onHide = () => drillStore.getState().unloading(readTime());
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [readTime]);

  // The calculator's open time is counted per question.
  useEffect(() => () => testRoomStore.getState().leaveQuestion(id), [id]);

  // Arrow keys move, except while typing in a field or with a dialog open.
  const { onBack, onNext, disabled } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (disabled || e.altKey || e.ctrlKey || e.metaKey || testRoomStore.getState().breakStartedAt !== null) return;
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
  const section = question.section;
  const kind = question.answer.kind;
  const available = toolsFor(section, kind);
  const onFigureZoom = (percent: number) => actions.toolEvent('figure_zoomed', { percent });
  const hasStimulus = question.stimulusHtml !== null && question.stimulusHtml !== '';
  const annotations = p.annotations ?? [];
  const annotate = {
    annotations,
    onChange: (next: typeof annotations) => actions.setAnnotations(next),
    onEvent: actions.toolEvent,
    onFigureZoom,
  };

  const leftPane =
    section === 'rw' ? (
      hasStimulus ? (
        <div data-pane="passage">
          <AnnotatedHtml html={question.stimulusHtml as string} target="passage" {...annotate} />
        </div>
      ) : null
    ) : kind === 'spr' ? (
      <div>
        <SprDirections />
      </div>
    ) : null;

  const rightPane = (
    <div className="space-y-5">
      <QuestionBar
        number={session.index + 1}
        flagged={p.flagged}
        onToggleFlag={() => actions.toggleFlag()}
        eliminator={available.includes('eliminator') ? { on: eliminatorOn, onToggle: () => testRoomStore.getState().toggleEliminator() } : undefined}
      />
      {section === 'math' && hasStimulus && <ContentHtml html={question.stimulusHtml as string} onFigureZoom={onFigureZoom} />}
      {section === 'rw' ? <AnnotatedHtml html={question.stemHtml} target="stem" {...annotate} /> : <ContentHtml html={question.stemHtml} onFigureZoom={onFigureZoom} />}
      {question.answer.kind === 'spr' ? (
        <SprInput value={p.response ?? ''} onChange={(r) => actions.select(r)} questionNumber={session.index + 1} />
      ) : (
        <ChoiceList
          choices={question.answer.choices}
          response={p.response}
          onSelect={(r) => actions.select(r)}
          struck={p.struck}
          onStrike={(l) => actions.strike(l)}
          eliminatorOn={eliminatorOn}
        />
      )}
    </div>
  );

  return (
    <SplitPanes
      left={leftPane}
      right={rightPane}
      side={props.side}
      leftFraction={splitFraction}
      onResize={(f) => testRoomStore.getState().setSplit(f)}
    />
  );
}
