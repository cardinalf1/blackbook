import type { TestRoomFooterProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function TestRoomFooter({
  label,
  index,
  total,
  menuOpen,
  onToggleMenu,
  onBack,
  onNext,
  disabled,
}: TestRoomFooterProps) {
  return (
    <footer className="flex h-16 w-full items-center justify-between border-t border-[#27272A] bg-black px-6 text-white select-none">
      <div className="flex flex-1 items-center justify-start">
        <span className="font-mono text-xs text-zinc-400">{label}</span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          className={`flex items-center gap-2 rounded-[2px] border border-[#27272A] bg-black px-4 py-1.5 font-mono text-sm text-white hover:border-zinc-500 ${T.focus}`}
        >
          <span>
            Question {index + 1} of {total}
          </span>
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <path d="M4 6l4 4 4-4" />
            ) : (
              <path d="M4 10l4-4 4 4" />
            )}
          </svg>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={onBack}
            disabled={disabled}
            className={T.secondary}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className={T.primary}
        >
          Next
        </button>
      </div>
    </footer>
  );
}
