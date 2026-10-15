import type { ExamHeaderProps } from '../../types/exam';
import { formatCountdown } from '../../utils/formatCountdown';

export function ExamHeader({
  title,
  remainingMs,
  timerHidden,
  onToggleTimer,
  paused,
  onPauseClick,
  onOpenReference,
}: ExamHeaderProps) {
  const isFiveMinOrLess = remainingMs <= 5 * 60 * 1000;
  const isWarning = !timerHidden && !paused && isFiveMinOrLess;

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[#27272A] bg-[#121215] px-4 text-[#FAFAFA] sm:px-6">
      {/* Left: Module title */}
      <div className="flex min-w-0 flex-1 items-center">
        <h1 className="truncate text-sm font-medium text-zinc-100 sm:text-base">
          {title}
        </h1>
      </div>

      {/* Center: Countdown timer */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {paused ? (
          <span
            role="timer"
            aria-live="off"
            data-warning="false"
            className="font-mono text-lg font-bold text-amber-400"
          >
            Paused
          </span>
        ) : timerHidden ? (
          <span
            role="timer"
            aria-live="off"
            data-warning="false"
            className="font-mono text-sm font-medium text-zinc-400"
          >
            Timer hidden
          </span>
        ) : (
          <span
            role="timer"
            aria-live="off"
            data-warning={isWarning ? 'true' : 'false'}
            className={`font-mono text-xl font-bold tracking-wider ${
              isWarning ? 'text-amber-400' : 'text-zinc-100'
            }`}
          >
            {formatCountdown(remainingMs)}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleTimer}
          aria-pressed={timerHidden}
          className="mt-0.5 rounded px-2 py-0.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {timerHidden ? 'Show' : 'Hide'}
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex flex-1 items-center justify-end gap-2">
        {onOpenReference && (
          <button
            type="button"
            onClick={onOpenReference}
            className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Reference
          </button>
        )}
        <button
          type="button"
          disabled={paused}
          onClick={onPauseClick}
          className="rounded-md border border-[#27272A] bg-[#121215] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Pause
        </button>
      </div>
    </header>
  );
}
