// The save-on-exit sequence. On a normal close, quit, sign-out or shutdown:
//   1. the page flushes its event buffer and any pending answer, and confirms;
//   2. the local program finishes writes, folds the log into the database and takes the exit snapshot;
//   3. the local program stops (its control line is closed; killed if it does not stop in time).
// Each step has its own timeout and the whole run has a hard limit, so quitting can never hang.

export interface ExitSteps {
  flushPage(): Promise<unknown>;
  prepareProgram(): Promise<unknown>;
  stopProgram(): Promise<unknown>;
}

export interface ExitTimeouts {
  pageMs: number;
  programMs: number;
  stopMs: number;
  totalMs: number;
}

export const EXIT_TIMEOUTS: ExitTimeouts = { pageMs: 3000, programMs: 8000, stopMs: 4000, totalMs: 15000 };

export type StepOutcome = 'done' | 'timeout' | 'failed';

export interface ExitReport {
  page: StepOutcome;
  program: StepOutcome;
  stop: StepOutcome;
  /** True when the hard limit cut the run short. */
  cutShort: boolean;
}

function timed(p: () => Promise<unknown>, ms: number): Promise<StepOutcome> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    p().then(
      () => {
        clearTimeout(t);
        resolve('done');
      },
      () => {
        clearTimeout(t);
        resolve('failed');
      },
    );
  });
}

export async function runExitSequence(steps: ExitSteps, t: ExitTimeouts = EXIT_TIMEOUTS): Promise<ExitReport> {
  const report: ExitReport = { page: 'timeout', program: 'timeout', stop: 'timeout', cutShort: false };
  const run = (async () => {
    report.page = await timed(() => steps.flushPage(), t.pageMs);
    // Even when the page did not answer, the program still saves what it has.
    report.program = await timed(() => steps.prepareProgram(), t.programMs);
    report.stop = await timed(() => steps.stopProgram(), t.stopMs);
  })();
  const limit = new Promise<'limit'>((r) => setTimeout(() => r('limit'), t.totalMs));
  if ((await Promise.race([run.then(() => 'ok' as const), limit])) === 'limit') report.cutShort = true;
  return report;
}

/** Text of the one dialog shown when the window is closed during a timed test. */
export const TIMED_TEST_DIALOG = {
  title: 'A timed test is in progress',
  message: 'Your test is saved. The clock keeps running while Blackbook is closed.',
  detail: 'When you open Blackbook again, the test continues with the time that is left.',
  buttons: ['Cancel', 'Quit'] as const,
  cancelId: 0,
  defaultId: 0,
};
