import { useEffect, useId, useRef } from 'react';
import type { FinishConfirmProps } from '../../types/session';

export function FinishConfirm({
  unanswered,
  flagged,
  onGoTo,
  onConfirm,
  onCancel,
  busy,
}: FinishConfirmProps) {
  const headingId = useId();
  const keepWorkingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    keepWorkingRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  const allClear = unanswered.length === 0 && flagged.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-md space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-6 shadow-xl"
      >
        <h2 id={headingId} className="font-mono text-base font-semibold text-zinc-100">
          Finish this drill?
        </h2>

        <div className="space-y-3 text-sm">
          {allClear ? (
            <p className="text-zinc-300">Every question is answered.</p>
          ) : (
            <div className="space-y-2">
              {unanswered.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-zinc-300">
                  <span>Unanswered:</span>
                  {unanswered.map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={busy}
                      onClick={() => onGoTo(num)}
                      className="rounded border border-[#27272A] bg-[#0A0A0C] px-2 py-0.5 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}

              {flagged.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-zinc-300">
                  <span>Flagged for review:</span>
                  {flagged.map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={busy}
                      onClick={() => onGoTo(num)}
                      className="rounded border border-[#27272A] bg-[#0A0A0C] px-2 py-0.5 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-zinc-400">
            You will see your score and the explanations after finishing. You cannot change answers after that.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
          <button
            ref={keepWorkingRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Keep working
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {busy ? 'Finishing...' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
