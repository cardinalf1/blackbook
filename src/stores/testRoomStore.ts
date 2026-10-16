import { preferencesStore } from '../services/storage';
// Test-room tool state (Phase 9): which panels are open, the calculator's place, mode and saved
// state, the eliminator, the line reader, the split and the zoom. UI state only: nothing here is
// stored with the session except through drillStore. Every change that matters for telemetry goes
// through `emit` with ids, counts and times only (docs/telemetry.md).
//
// Scope: panel and calculator state belong to one module (or one drill). `enterScope` resets them
// when the module changes (ASSUMED: the calculator keeps its expressions across questions inside a
// module and starts fresh in the next one). The zoom level lasts for the whole app session.

import { createStore, useStore, type StoreApi } from 'zustand';
import {
  CALCULATOR_DEFAULT_MODE,
  CALCULATOR_DEFAULT_RECT,
  SPLIT_DEFAULT_FRACTION,
  SPLIT_MAX_FRACTION,
  SPLIT_MIN_FRACTION,
  ZOOM_DEFAULT_INDEX,
  ZOOM_LEVELS,
} from '../config/testRoomConfig';
import type { EventPayloads, ToolEventType } from '../types/session';
import { drillStore } from './drillStore';
import type { CalculatorEngineState, CalculatorMode, PanelRect } from '../types/testRoom';

export type ToolDialog = 'help' | 'shortcuts' | null;

export interface TestRoomState {
  /** The module or drill session these panels belong to. */
  scope: string | null;
  directionsOpen: boolean;
  moreOpen: boolean;
  menuOpen: boolean;
  dialog: ToolDialog;
  referenceOpen: boolean;
  referenceExpanded: boolean;
  calculatorOpen: boolean;
  calculatorMode: CalculatorMode;
  calculatorRect: PanelRect;
  calculatorStates: Partial<Record<CalculatorMode, CalculatorEngineState>>;
  eliminatorOn: boolean;
  lineReaderOn: boolean;
  splitFraction: number;
  zoomIndex: number;
  /** Monotonic ms when an unscheduled break started; null when not on one. */
  breakStartedAt: number | null;
}

type Emit = <T extends ToolEventType>(type: T, payload: EventPayloads[T], questionId?: string | null) => void;

export interface TestRoomActions {
  /** Resets per-module state when `scope` differs from the current one. Zoom is kept. */
  enterScope(scope: string): void;
  toggleDirections(): void;
  toggleMore(): void;
  closeMore(): void;
  toggleMenu(open?: boolean): void;
  openDialog(dialog: Exclude<ToolDialog, null>): void;
  closeDialog(): void;
  toggleReference(): void;
  toggleReferenceExpanded(): void;
  /** `questionId` is the question on screen, for the calculator's per-question time. */
  toggleCalculator(questionId: string | null): void;
  setCalculatorMode(mode: CalculatorMode): void;
  setCalculatorRect(rect: PanelRect): void;
  saveCalculatorState(mode: CalculatorMode, state: CalculatorEngineState): void;
  /** Logs the calculator's open time on the question being left (call when the question changes). */
  leaveQuestion(questionId: string | null): void;
  toggleEliminator(): void;
  toggleLineReader(): void;
  setSplit(fraction: number): void;
  /** +1 zooms in, -1 out, 0 resets. */
  zoom(step: 1 | -1 | 0): void;
  startBreak(): void;
  endBreak(): void;
}

export type TestRoomStore = TestRoomState & TestRoomActions;

const SCOPED: Omit<TestRoomState, 'scope' | 'zoomIndex'> = {
  directionsOpen: false,
  moreOpen: false,
  menuOpen: false,
  dialog: null,
  referenceOpen: false,
  referenceExpanded: false,
  calculatorOpen: false,
  calculatorMode: CALCULATOR_DEFAULT_MODE,
  calculatorRect: CALCULATOR_DEFAULT_RECT,
  calculatorStates: {},
  // ASSUMED: the eliminator starts off in each module (the screenshots show it on, after a click).
  eliminatorOn: false,
  lineReaderOn: false,
  splitFraction: SPLIT_DEFAULT_FRACTION,
  breakStartedAt: null,
};

export function createTestRoomStore(deps: { emit: Emit; mono?: () => number }): StoreApi<TestRoomStore> {
  const mono = deps.mono ?? (() => performance.now());
  const emit = deps.emit;
  /** When the calculator's open time on the current question started counting. */
  let calcSince: number | null = null;

  return createStore<TestRoomStore>()((set, get) => {
    const flushCalcTime = (questionId: string | null) => {
      if (calcSince === null) return;
      const openMs = Math.max(0, Math.round(mono() - calcSince));
      calcSince = null;
      if (questionId !== null && openMs > 0) emit('calculator_time', { openMs }, questionId);
    };

    return {
      scope: null,
      zoomIndex: ZOOM_DEFAULT_INDEX,
      ...SCOPED,

      enterScope(scope) {
        if (get().scope === scope) return;
        calcSince = null;
        set({ scope, ...SCOPED });
      },

      toggleDirections() {
        const open = !get().directionsOpen;
        if (open) emit('directions_opened', {});
        set({ directionsOpen: open, moreOpen: false });
      },

      toggleMore() {
        const open = !get().moreOpen;
        if (open) emit('more_opened', {});
        set({ moreOpen: open, directionsOpen: false });
      },

      closeMore() {
        if (get().moreOpen) set({ moreOpen: false });
      },

      toggleMenu(open) {
        const next = open ?? !get().menuOpen;
        if (next === get().menuOpen) return;
        emit(next ? 'navigator_opened' : 'navigator_closed', {});
        set({ menuOpen: next });
      },

      openDialog(dialog) {
        emit(dialog === 'help' ? 'help_opened' : 'shortcuts_opened', {});
        set({ dialog, moreOpen: false });
      },

      closeDialog() {
        set({ dialog: null });
      },

      toggleReference() {
        const open = !get().referenceOpen;
        emit(open ? 'reference_opened' : 'reference_closed', {});
        set({ referenceOpen: open, referenceExpanded: open ? get().referenceExpanded : false });
      },

      toggleReferenceExpanded() {
        const expanded = !get().referenceExpanded;
        emit('reference_expanded', { expanded });
        set({ referenceExpanded: expanded });
      },

      toggleCalculator(questionId) {
        const open = !get().calculatorOpen;
        if (open) {
          calcSince = mono();
          emit('calculator_opened', { mode: get().calculatorMode });
        } else {
          flushCalcTime(questionId);
          emit('calculator_closed', {});
        }
        set({ calculatorOpen: open });
      },

      setCalculatorMode(mode) {
        if (mode === get().calculatorMode) return;
        emit('calculator_mode_switched', { mode });
        set({ calculatorMode: mode });
      },

      setCalculatorRect(rect) {
        set({ calculatorRect: rect });
      },

      saveCalculatorState(mode, state) {
        set({ calculatorStates: { ...get().calculatorStates, [mode]: state } });
      },

      leaveQuestion(questionId) {
        if (!get().calculatorOpen) return;
        flushCalcTime(questionId);
        calcSince = mono();
      },

      toggleEliminator() {
        const on = !get().eliminatorOn;
        emit('eliminator_toggled', { on });
        set({ eliminatorOn: on });
      },

      toggleLineReader() {
        const on = !get().lineReaderOn;
        emit('line_reader_toggled', { on });
        set({ lineReaderOn: on, moreOpen: false });
      },

      setSplit(fraction) {
        const next = Math.min(SPLIT_MAX_FRACTION, Math.max(SPLIT_MIN_FRACTION, fraction));
        set({ splitFraction: next });
        void preferencesStore.update({ toolPreferences: { splitFraction: next } }).catch(() => undefined);
      },

      zoom(step) {
        const cur = get().zoomIndex;
        const next = step === 0 ? ZOOM_DEFAULT_INDEX : Math.min(ZOOM_LEVELS.length - 1, Math.max(0, cur + step));
        if (next === cur) return;
        emit('zoom_changed', { percent: ZOOM_LEVELS[next] as number });
        set({ zoomIndex: next });
        void preferencesStore.update({ toolPreferences: { zoomIndex: next } }).catch(() => undefined);
      },

      startBreak() {
        if (get().breakStartedAt !== null) return;
        emit('unscheduled_break_started', {});
        set({ breakStartedAt: mono(), moreOpen: false });
      },

      endBreak() {
        const since = get().breakStartedAt;
        if (since === null) return;
        emit('unscheduled_break_ended', { breakMs: Math.max(0, Math.round(mono() - since)) });
        set({ breakStartedAt: null });
      },
    };
  });
}

/** The current zoom in percent. */
export function zoomPercent(s: Pick<TestRoomState, 'zoomIndex'>): number {
  return ZOOM_LEVELS[s.zoomIndex] ?? 100;
}

/** App-wide store: tool events go to the event log through the drill store, on the session on screen. */
export const testRoomStore = createTestRoomStore({ emit: (type, payload, questionId) => drillStore.getState().toolEvent(type, payload, questionId) });

export function useTestRoom<T>(selector: (s: TestRoomStore) => T): T {
  return useStore(testRoomStore, selector);
}

if (typeof window !== 'undefined') {
  void preferencesStore.get().then((prefs) => {
    const tp = prefs.toolPreferences;
    if (!tp) return;
    testRoomStore.setState((s) => ({
      ...s,
      zoomIndex: tp.zoomIndex ?? s.zoomIndex,
      calculatorMode: tp.calculatorMode ?? s.calculatorMode,
      splitFraction: tp.splitFraction ?? s.splitFraction,
    }));
  }).catch(() => undefined);
}
