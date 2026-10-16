// The page's side of the desktop shell. In a plain browser (`bun run dev`) there is no shell and
// everything here is a no-op, so the app works the same in both.
//
// Before the window closes, the shell asks two things:
//  - is a timed module or break running? (then it shows the one "the clock keeps running" dialog)
//  - please save everything: the open question's time and answer, the drill/exam save queue, and
//    the telemetry buffer. The shell waits for the answer with a timeout.

import { drillStore } from '../../stores/drillStore';
import { testStore } from '../../stores/testStore';
import type { BlackbookDesktop, DesktopPage, DesktopPageState } from '../../types/desktop';
import type { SessionRecord } from '../../types/session';
import { telemetry } from '../telemetry';
import { BEFORE_EXIT_EVENT } from './events';

export { BEFORE_EXIT_EVENT };

export function desktop(): BlackbookDesktop | null {
  return typeof window !== 'undefined' ? (window.blackbookDesktop ?? null) : null;
}

/** True while a timed module (or its review page) is open, or a test's break is counting down. */
export function timedTestInProgress(drill: SessionRecord | null, test: SessionRecord | null, now: number): boolean {
  if (drill?.mode === 'exam' && drill.status === 'in_progress' && drill.exam && drill.exam.phase !== 'submitted') return true;
  const b = test?.status === 'in_progress' ? test.test?.break : null;
  return !!b && b.endedAt === null && b.deadlineAt > now;
}

export function pageState(now = Date.now()): DesktopPageState {
  return { timedTestInProgress: timedTestInProgress(drillStore.getState().session, testStore.getState().record, now) };
}

/** Saves everything the page holds. Resolves when the save queue and the event buffer are on disk (or failed). */
export async function flushForExit(): Promise<void> {
  window.dispatchEvent(new Event(BEFORE_EXIT_EVENT));
  await drillStore.getState().whenSaved();
  await telemetry.flush();
}

let installed = false;

/** Connects the shell's questions and the menu to the page. Call once at start. */
export function installDesktopHooks(navigate: (page: DesktopPage) => void): void {
  const d = desktop();
  if (!d || installed) return;
  installed = true;
  d.onStateQuery(() => pageState());
  d.onFlush(flushForExit);
  d.onNavigate(navigate);
}
