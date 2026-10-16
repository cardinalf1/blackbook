import { useState } from 'react';
import type { ReviewScreenProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

function BookmarkIcon({ className = 'h-3 w-3 text-amber-300' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 2.5h9v11.5l-4.5-3.5-4.5 3.5V2.5z" />
    </svg>
  );
}

export function ReviewScreen({
  title,
  items,
  onJump,
  onSubmit,
  busy,
}: ReviewScreenProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const unansweredCount = items.filter((item) => !item.answered).length;
  const markedCount = items.filter((item) => item.flagged).length;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl flex-col justify-between p-6 md:p-10 select-none">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            {title}
          </span>
          <h1 className="mt-1 font-mono text-2xl font-bold uppercase tracking-wider text-white">
            Check your work
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Unanswered and marked questions are shown below so you can review before submitting.
          </p>
        </div>

        {/* Counts summary and legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2px] border border-[#27272A] bg-black p-4 text-xs">
          <div className="flex items-center gap-6 font-mono text-zinc-300">
            <div>
              Unanswered: <span className="font-bold text-white">{unansweredCount}</span>
            </div>
            <div>
              For Review: <span className="font-bold text-amber-300">{markedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-[2px] border border-dashed border-zinc-400" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookmarkIcon className="h-3.5 w-3.5 text-amber-300" />
              <span>For Review</span>
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2.5 py-2">
          {items.map((item) => (
            <button
              key={item.number}
              type="button"
              onClick={() => onJump(item.number - 1)}
              aria-label={`Question ${item.number}${item.answered ? ', answered' : ', unanswered'}${item.flagged ? ', flagged for review' : ''}`}
              data-answered={item.answered ? 'true' : undefined}
              data-unanswered={!item.answered ? 'true' : undefined}
              data-flagged={item.flagged ? 'true' : undefined}
              className={`relative flex h-11 w-11 items-center justify-center rounded-[2px] font-mono text-sm font-semibold transition-colors ${
                item.answered
                  ? 'border border-zinc-200 bg-white text-black hover:bg-zinc-200'
                  : 'border border-dashed border-zinc-500 bg-black text-zinc-200 hover:border-zinc-300 hover:text-white'
              } ${T.focus}`}
            >
              <span>{item.number}</span>
              {item.flagged && (
                <div
                  data-testid="flagged-marker"
                  className="absolute top-0.5 right-0.5"
                >
                  <BookmarkIcon className="h-2.5 w-2.5 text-amber-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Submit Button */}
      <div className="mt-8 flex justify-end border-t border-[#27272A] pt-6">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={busy}
          className={T.primary}
        >
          Submit module
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setShowConfirm(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="review-confirm-heading"
            aria-describedby="review-confirm-desc"
            className={`${T.card} flex w-full max-w-md flex-col p-6 shadow-2xl`}
          >
            <h2 id="review-confirm-heading" className={T.title}>
              Submit module?
            </h2>
            <p id="review-confirm-desc" className="my-4 text-sm text-zinc-300">
              Submit this module? You can't return to it after you submit.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={busy}
                className={T.secondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onSubmit();
                }}
                disabled={busy}
                className={T.primary}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
