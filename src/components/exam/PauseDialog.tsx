import { useEffect, useId, useRef } from 'react';
import type { PauseDialogProps } from '../../types/exam';
import { formatCountdown } from '../../utils/formatCountdown';

export function PauseDialog({
  mode,
  reasons,
  onConfirm,
  onCancel,
  onResume,
  remainingMs,
}: PauseDialogProps) {
  const headingId = useId();
  const keepWorkingRef = useRef<HTMLButtonElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === 'confirm') {
      keepWorkingRef.current?.focus();
    } else if (mode === 'paused') {
      resumeButtonRef.current?.focus();
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'confirm') {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onCancel]);

  if (mode === 'paused') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0C] p-6 text-center text-[#FAFAFA]">
        <h2 className="font-mono text-3xl font-bold tracking-tight text-amber-400">
          Paused
        </h2>

        <div className="mt-6 flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Time left
          </span>
          <span className="font-mono text-4xl font-bold text-zinc-100">
            {formatCountdown(remainingMs)}
          </span>
        </div>

        <p className="mt-4 text-sm text-zinc-400">
          This result is marked as paused.
        </p>

        <button
          ref={resumeButtonRef}
          type="button"
          onClick={onResume}
          className="mt-8 rounded-md bg-zinc-100 px-6 py-2 font-mono text-sm font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Resume
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-md space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-6 shadow-xl"
      >
        <h2 id={headingId} className="font-mono text-base font-semibold text-zinc-100">
          Emergency pause
        </h2>

        <p className="text-sm text-zinc-300">
          Pausing stops the clock and hides the questions. This result will be marked as paused and will not count as a clean timed run.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Why are you pausing?
          </p>
          <div className="flex flex-col gap-2">
            {reasons.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => onConfirm(reason)}
                className="w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-3.5 py-2 text-left text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-[#27272A] pt-4">
          <button
            ref={keepWorkingRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Keep working
          </button>
        </div>
      </div>
    </div>
  );
}
