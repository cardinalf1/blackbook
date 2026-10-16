// The test-room tools inside a drill (Phase 9): Calculator and Reference for Math, highlights for
// Reading and Writing (through AnnotatedHtml), figure zoom for both. Drills keep their own screen.

import { useEffect } from 'react';
import { calculatorEngine } from '../../services/calculator/engine';
import { testRoomStore, useTestRoom } from '../../stores/testRoomStore';
import type { Section } from '../../types/sat';
import { T } from '../ui/tokens';
import { CalculatorPanel } from './CalculatorPanel';
import { ReferencePanel } from './ReferencePanel';

/** Scopes the tools to this drill session and counts calculator time per question. */
export function useDrillTools(sessionId: string | null, questionId: string | null) {
  useEffect(() => {
    if (sessionId) testRoomStore.getState().enterScope(sessionId);
  }, [sessionId]);
  useEffect(() => () => testRoomStore.getState().leaveQuestion(questionId), [questionId]);
}

const toolClass = (active: boolean) =>
  `rounded-[2px] border px-2 py-0.5 font-mono text-xs ${T.focus} ${active ? 'border-white text-white underline underline-offset-4' : 'border-[#27272A] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}`;

/** Header buttons: Math only (Reading and Writing highlights work by selecting text). */
export function DrillToolButtons({ section, questionId }: { section: Section; questionId: string | null }) {
  const calculatorOpen = useTestRoom((s) => s.calculatorOpen);
  const referenceOpen = useTestRoom((s) => s.referenceOpen);
  if (section !== 'math') return null;
  return (
    <>
      <button type="button" aria-pressed={calculatorOpen} onClick={() => testRoomStore.getState().toggleCalculator(questionId)} className={toolClass(calculatorOpen)}>
        Calculator
      </button>
      <button type="button" aria-pressed={referenceOpen} onClick={() => testRoomStore.getState().toggleReference()} className={toolClass(referenceOpen)}>
        Reference
      </button>
    </>
  );
}

/** The floating calculator and the reference sheet docked on the right of the window. */
export function DrillToolPanels({ section, questionId }: { section: Section; questionId: string | null }) {
  const room = useTestRoom((s) => s);
  if (section !== 'math') return null;
  return (
    <>
      {room.referenceOpen && (
        <div className={`fixed inset-y-0 right-0 z-40 ${room.referenceExpanded ? 'w-[50vw]' : 'w-[28rem] max-w-[90vw]'}`}>
          <ReferencePanel
            expanded={room.referenceExpanded}
            onToggleExpand={() => testRoomStore.getState().toggleReferenceExpanded()}
            onClose={() => testRoomStore.getState().toggleReference()}
          />
        </div>
      )}
      {room.calculatorOpen && (
        <CalculatorPanel
          mode={room.calculatorMode}
          onModeChange={(m) => testRoomStore.getState().setCalculatorMode(m)}
          rect={room.calculatorRect}
          onRectChange={(r) => testRoomStore.getState().setCalculatorRect(r)}
          onClose={() => testRoomStore.getState().toggleCalculator(questionId)}
          engine={calculatorEngine()}
          engineState={room.calculatorStates[room.calculatorMode] ?? null}
          onEngineStateChange={(m, st) => testRoomStore.getState().saveCalculatorState(m, st)}
        />
      )}
    </>
  );
}
