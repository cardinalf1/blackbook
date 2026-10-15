import { useState } from 'react';
import type { ExamReviewProps } from '../../types/exam';
import { formatCountdown } from '../../utils/formatCountdown';

export function ExamReview({
  title,
  items,
  remainingMs,
  onJump,
  onSubmit,
  busy,
}: ExamReviewProps) {
  const [confirming, setConfirming] = useState(false);

  const answeredCount = items.filter((item) => item.answered).length;
  const totalCount = items.length;

  const unansweredItems = items.filter((item) => !item.answered);
  const flaggedItems = items.filter((item) => item.flagged);

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 text-[#FAFAFA]">
      <div className="space-y-6 rounded-lg border border-[#27272A] bg-[#121215] p-6 shadow-xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#27272A] pb-4">
          <div>
            <div className="font-mono text-xs text-zinc-400">{title}</div>
            <h1 className="mt-1 font-mono text-xl font-semibold text-zinc-100">
              Check your work
            </h1>
          </div>
          <div className="font-mono text-sm text-zinc-300">
            Time left: {formatCountdown(remainingMs)}
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs leading-relaxed text-zinc-400">
          On test day, you would not be able to move on to the next module until time expires. Here you can submit now or keep working. Answers cannot be changed after you submit.
        </p>

        {/* Summary */}
        <div className="font-mono text-sm font-medium text-zinc-200">
          {answeredCount} of {totalCount} answered
        </div>

        {/* Unanswered and Flagged lists */}
        {(unansweredItems.length > 0 || flaggedItems.length > 0) && (
          <div className="space-y-3 rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
            {unansweredItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-medium text-zinc-400">Unanswered:</span>
                <div className="flex flex-wrap gap-1.5">
                  {unansweredItems.map((item) => (
                    <button
                      key={item.number}
                      type="button"
                      disabled={busy}
                      onClick={() => onJump(item.number - 1)}
                      className="rounded border border-dashed border-zinc-500 bg-transparent px-2.5 py-1 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      {item.number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {flaggedItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-medium text-zinc-400">Marked for review:</span>
                <div className="flex flex-wrap gap-1.5">
                  {flaggedItems.map((item) => (
                    <button
                      key={item.number}
                      type="button"
                      disabled={busy}
                      onClick={() => onJump(item.number - 1)}
                      className="rounded border border-[#27272A] bg-zinc-900 px-2.5 py-1 font-mono text-xs text-amber-400 transition-colors hover:border-zinc-500 hover:text-amber-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    >
                      {item.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Question Grid */}
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {items.map((item) => {
            const status = item.answered ? 'answered' : 'unanswered';
            const flagSuffix = item.flagged ? ', marked for review' : '';
            const ariaLabel = `Question ${item.number}, ${status}${flagSuffix}`;

            return (
              <button
                key={item.number}
                type="button"
                disabled={busy}
                aria-label={ariaLabel}
                onClick={() => onJump(item.number - 1)}
                className={`relative flex h-10 w-10 items-center justify-center rounded font-mono text-xs transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  item.answered
                    ? 'border border-zinc-200 bg-zinc-200 font-semibold text-zinc-900 hover:bg-white'
                    : 'border border-dashed border-zinc-500 bg-transparent text-zinc-300 hover:border-zinc-400 hover:text-zinc-100'
                }`}
              >
                {item.flagged && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1 -right-1 text-[10px] leading-none text-amber-400"
                  >
                    ⚑
                  </span>
                )}
                {item.number}
              </button>
            );
          })}
        </div>

        {/* Submit / Inline Confirmation */}
        <div className="border-t border-[#27272A] pt-4">
          {confirming ? (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirm module submission"
              className="flex flex-col items-center justify-between gap-4 rounded-lg border border-red-900/60 bg-red-950/20 p-4 sm:flex-row"
            >
              <p className="text-xs text-zinc-200">
                Submit this module? You cannot come back to it.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSubmit}
                  className="rounded-md bg-red-600 px-4 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  {busy ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(true)}
                className="rounded-md bg-zinc-100 px-5 py-2 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {busy ? 'Submitting...' : 'Submit module'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
