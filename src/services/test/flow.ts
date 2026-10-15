// The full-test state machine: pure transitions on TestState. The store persists after each one.
// Module 1 of each section is assembled when the test starts; module 2 when routing is decided.

import { EXAM_MODULES } from '../../config/examConfig';
import { BREAK_MS, SCORING_CONFIG_VERSION } from '../../config/scoringConfig';
import type { ExamModuleSpec } from '../../types/exam';
import type { Section } from '../../types/sat';
import type { ModuleKey, Route, RoutingDecision, TestBreak, TestKind, TestModuleSlot, TestState, TestStep } from '../../types/test';

export const moduleKey = (section: Section, moduleNumber: 1 | 2): ModuleKey => `${section}${moduleNumber}` as ModuleKey;

export function stepsFor(kind: TestKind): TestStep[] {
  const rw: TestStep[] = [
    { type: 'module', key: 'rw1' },
    { type: 'module', key: 'rw2' },
  ];
  const math: TestStep[] = [
    { type: 'module', key: 'math1' },
    { type: 'module', key: 'math2' },
  ];
  if (kind === 'rw') return rw;
  if (kind === 'math') return math;
  return [...rw, { type: 'break' }, ...math];
}

export function specFor(section: Section, moduleNumber: 1 | 2, tier: 'routing' | Route): ExamModuleSpec {
  return { section, moduleNumber, tier };
}

export function newSlot(spec: ExamModuleSpec, questionIds: readonly string[], notes: readonly string[]): TestModuleSlot {
  return {
    key: moduleKey(spec.section, spec.moduleNumber),
    section: spec.section,
    moduleNumber: spec.moduleNumber,
    tier: spec.tier,
    questionIds: [...questionIds],
    notes: [...notes],
    sessionId: null,
  };
}

/** A new test positioned on its first step, holding the already-assembled module 1 slots. */
export function newTest(kind: TestKind, includeSeen: boolean, module1Slots: readonly TestModuleSlot[]): TestState {
  const slots: TestState['slots'] = {};
  for (const s of module1Slots) slots[s.key] = s;
  return {
    kind,
    steps: stepsFor(kind),
    stepIndex: 0,
    slots,
    routing: [],
    break: null,
    includeSeen,
    paused: false,
    estimate: null,
    configVersion: SCORING_CONFIG_VERSION,
  };
}

export function currentStep(t: TestState): TestStep | null {
  return t.steps[t.stepIndex] ?? null;
}

export function isOver(t: TestState): boolean {
  return t.stepIndex >= t.steps.length;
}

/** The slot the user is on, or null on a break or when the test is over. */
export function currentSlot(t: TestState): TestModuleSlot | null {
  const step = currentStep(t);
  return step?.type === 'module' ? (t.slots[step.key] ?? null) : null;
}

export function sectionsOf(t: TestState): Section[] {
  return t.kind === 'full' ? ['rw', 'math'] : [t.kind];
}

export function routeOf(t: TestState, section: Section): Route | null {
  return t.routing.find((r) => r.section === section)?.route ?? null;
}

/** Marks the slot as started with this session. A slot that already has a session is left alone. */
export function attachSession(t: TestState, key: ModuleKey, sessionId: string): TestState {
  const slot = t.slots[key];
  if (!slot || slot.sessionId !== null) return t;
  return { ...t, slots: { ...t.slots, [key]: { ...slot, sessionId } } };
}

/** Stores the routing decision and the assembled module 2 slot. The step does not advance yet. */
export function applyRouting(t: TestState, decision: RoutingDecision, module2: TestModuleSlot): TestState {
  if (t.routing.some((r) => r.section === decision.section)) return t;
  return { ...t, routing: [...t.routing, decision], slots: { ...t.slots, [module2.key]: module2 } };
}

/** Moves to the next step. Entering a break starts its clock from an absolute deadline. */
export function advance(t: TestState, now: number, breakMs: number = BREAK_MS): TestState {
  const stepIndex = t.stepIndex + 1;
  const next = t.steps[stepIndex];
  if (next?.type === 'break') {
    const br: TestBreak = { startedAt: now, durationMs: breakMs, deadlineAt: now + breakMs, endedAt: null, endedEarly: false };
    return { ...t, stepIndex, break: br };
  }
  return { ...t, stepIndex };
}

export function breakRemainingMs(br: TestBreak, now: number): number {
  return br.endedAt !== null ? 0 : Math.max(0, br.deadlineAt - now);
}

/** Ends the break (early or because it ran out) and moves on. Safe to call twice. */
export function endBreak(t: TestState, now: number, early: boolean): TestState {
  const step = currentStep(t);
  if (step?.type !== 'break' || !t.break || t.break.endedAt !== null) return t;
  const br: TestBreak = { ...t.break, endedAt: now, endedEarly: early };
  return { ...t, break: br, stepIndex: t.stepIndex + 1 };
}

/** Folds module pauses into the test: any pause marks the whole test for good. */
export function markPaused(t: TestState, paused: boolean): TestState {
  return t.paused || !paused ? t : { ...t, paused: true };
}

/** Questions in a finished test of this kind, both modules of each section. */
export function plannedQuestions(kind: TestKind): number {
  const sections: Section[] = kind === 'full' ? ['rw', 'math'] : [kind];
  return sections.reduce((s, sec) => s + 2 * EXAM_MODULES[sec].questions, 0);
}
