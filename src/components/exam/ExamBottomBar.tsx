import type { ExamBottomBarProps } from '../../types/exam';

export function ExamBottomBar({
  index,
  total,
  onBack,
  onNext,
  onOpenNavigator,
  disabled,
}: ExamBottomBarProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const nextLabel = isLast ? 'Review' : 'Next';

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-16 w-full items-center justify-between border-t border-[#27272A] bg-[#121215] px-6 text-[#FAFAFA]">
      <div className="flex-1" />

      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onOpenNavigator}
          aria-haspopup="dialog"
          className="flex items-center gap-2 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3.5 py-1.5 font-mono text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <span>Question {index + 1} of {total}</span>
          <span aria-hidden="true" className="text-xs text-zinc-400">▲</span>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <button
          type="button"
          disabled={isFirst || disabled}
          onClick={onBack}
          className="rounded-md border border-[#27272A] px-4 py-1.5 font-mono text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onNext}
          className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {nextLabel}
        </button>
      </div>
    </footer>
  );
}
