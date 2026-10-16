import { useEffect } from 'react';
import type { QuestionMenuProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

function PinIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="5" r="2.5" fill="currentColor" />
      <path d="M8 7.5V14" />
    </svg>
  );
}

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

export function QuestionMenu({
  title,
  items,
  currentIndex,
  onJump,
  onClose,
  onGoToReview,
}: QuestionMenuProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-20 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${T.card} flex w-full max-w-lg flex-col p-5 shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
          <h2 className={T.title}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-[2px] p-1 text-zinc-400 hover:text-white ${T.focus}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-around py-3 border-b border-[#27272A] text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <PinIcon className="h-3.5 w-3.5 text-white" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-[2px] border border-dashed border-zinc-400" />
            <span>Unanswered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookmarkIcon className="h-3.5 w-3.5 text-amber-300" />
            <span>For Review</span>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 py-4 max-h-64 overflow-y-auto p-1">
          {items.map((item) => {
            const isCurrent = item.number - 1 === currentIndex;
            return (
              <div key={item.number} className="relative flex flex-col items-center">
                {isCurrent && (
                  <div
                    data-testid="current-marker"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-white"
                  >
                    <PinIcon className="h-3 w-3" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onJump(item.number - 1)}
                  aria-label={`Question ${item.number}${item.answered ? ', answered' : ', unanswered'}${item.flagged ? ', flagged for review' : ''}${isCurrent ? ', current question' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-answered={item.answered ? 'true' : undefined}
                  data-unanswered={!item.answered ? 'true' : undefined}
                  data-current={isCurrent ? 'true' : undefined}
                  data-flagged={item.flagged ? 'true' : undefined}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-[2px] font-mono text-sm font-semibold transition-colors ${
                    item.answered
                      ? 'border border-zinc-200 bg-white text-black hover:bg-zinc-200'
                      : 'border border-dashed border-zinc-500 bg-black text-zinc-200 hover:border-zinc-300 hover:text-white'
                  } ${isCurrent ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''} ${T.focus}`}
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
              </div>
            );
          })}
        </div>

        {/* Review Page Action */}
        <div className="pt-3 border-t border-[#27272A]">
          <button
            type="button"
            onClick={onGoToReview}
            className={`${T.secondary} w-full`}
          >
            Go to Review Page
          </button>
        </div>
      </div>
    </div>
  );
}
