import type { UnscheduledBreakProps } from '../../types/testRoom';
import { formatCountdown } from '../../utils/formatCountdown';
import { T } from '../ui/tokens';

export function UnscheduledBreak({ remainingMs, onResume }: UnscheduledBreakProps) {
  return (
    <div
      role="region"
      aria-label="Unscheduled break"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0C] p-6 text-center select-none"
    >
      <div className="flex max-w-md flex-col items-center">
        <h1 className="font-mono text-2xl font-bold uppercase tracking-wider text-white">
          Unscheduled break
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          The clock keeps running.
        </p>
        <div
          aria-live="polite"
          className="my-8 font-mono text-5xl font-bold tabular-nums text-white"
        >
          {formatCountdown(remainingMs)}
        </div>
        <button
          type="button"
          onClick={onResume}
          className={T.primary}
        >
          Resume testing
        </button>
      </div>
    </div>
  );
}
