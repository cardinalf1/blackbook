import { useEffect, useRef } from 'react';
import type { NavigatorDrawerProps } from '../../types/exam';

export function NavigatorDrawer({
  items,
  currentIndex,
  onJump,
  onClose,
  onGoToReview,
}: NavigatorDrawerProps) {
  const currentButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="navigator-backdrop-wrapper"
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        data-testid="navigator-backdrop"
        aria-hidden="true"
        className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Question navigator"
        className="fixed bottom-20 left-1/2 z-10 flex w-full max-w-[420px] -translate-x-1/2 flex-col gap-4 rounded-lg border border-[#27272A] bg-[#121215] p-5 shadow-2xl text-[#FAFAFA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
          <h2 className="font-mono text-base font-semibold text-zinc-100">Questions</h2>
          <button
            type="button"
            aria-label="Close navigator"
            onClick={onClose}
            className="rounded-md p-1 font-mono text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            ✕
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between gap-2 border-b border-[#27272A] pb-3 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border-2 border-amber-400 bg-transparent text-[8px] text-amber-400"
            >
              ▾
            </span>
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-3.5 rounded-sm border border-dashed border-zinc-500 bg-transparent"
            />
            <span>Unanswered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-flex h-3.5 w-3.5 items-center justify-center text-amber-400"
            >
              ⚑
            </span>
            <span>Flagged</span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-9 gap-2">
          {items.map((item) => {
            const isCurrent = item.number - 1 === currentIndex;
            const status = item.answered ? 'answered' : 'unanswered';
            const flagLabel = item.flagged ? ', flagged' : '';
            const currentLabel = isCurrent ? ', current' : '';
            const ariaLabel = `Question ${item.number}, ${status}${flagLabel}${currentLabel}`;

            return (
              <button
                key={item.number}
                ref={isCurrent ? currentButtonRef : null}
                type="button"
                aria-label={ariaLabel}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onJump(item.number - 1)}
                className={`relative flex h-9 w-9 items-center justify-center rounded font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  item.answered
                    ? 'border border-zinc-200 bg-zinc-200 font-semibold text-zinc-900 hover:bg-white'
                    : 'border border-dashed border-zinc-500 bg-transparent text-zinc-300 hover:border-zinc-400 hover:text-zinc-100'
                } ${isCurrent ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#121215]' : ''}`}
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

        {/* Footer */}
        <div className="border-t border-[#27272A] pt-3">
          <button
            type="button"
            onClick={onGoToReview}
            className="w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-4 py-2 font-mono text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Go to review page
          </button>
        </div>
      </div>
    </div>
  );
}
