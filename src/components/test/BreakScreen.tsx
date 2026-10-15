import type { BreakScreenProps } from '../../types/test';
import { formatCountdown } from '../../utils/formatCountdown';

export function BreakScreen({
  remainingMs,
  nextTitle,
  onEnd,
  busy,
}: BreakScreenProps) {
  return (
    <section className="space-y-6 rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-[#FAFAFA] sm:p-8">
      <div>
        <h1 className="font-mono text-lg font-medium text-zinc-100">Break</h1>
        <p className="mt-1 text-sm text-zinc-400">Take a pause before the next section begins.</p>
      </div>

      <div
        role="timer"
        aria-live="off"
        className="font-mono text-5xl font-bold tracking-wider text-zinc-100 sm:text-6xl"
      >
        {formatCountdown(remainingMs)}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-zinc-300">
          Next: <span className="font-medium text-zinc-100">{nextTitle}</span>
        </p>
        <p className="text-xs text-zinc-400">
          The break ends by itself at zero. Finished modules cannot be reopened.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={onEnd}
          className="rounded-md bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          End break and continue
        </button>
      </div>
    </section>
  );
}
