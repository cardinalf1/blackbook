import type { QuestionBarProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function QuestionBar({
  number,
  flagged,
  onToggleFlag,
  eliminator,
}: QuestionBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#27272A] bg-[#0A0A0C] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[2px] bg-white font-mono text-sm font-bold text-black select-none"
          aria-label={`Question ${number}`}
        >
          {number}
        </span>

        <button
          type="button"
          onClick={onToggleFlag}
          aria-pressed={flagged}
          className={`flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-xs transition-colors ${
            flagged
              ? 'border-amber-500 bg-amber-950/30 text-amber-300'
              : 'border-[#27272A] bg-black text-zinc-400 hover:border-zinc-500 hover:text-white'
          } ${T.focus}`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill={flagged ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 2.5h9v11.5l-4.5-3.5-4.5 3.5V2.5z" />
          </svg>
          <span className="font-mono text-xs">
            {flagged ? 'Marked for Review' : 'Mark for Review'}
          </span>
        </button>
      </div>

      {eliminator && (
        <button
          type="button"
          onClick={eliminator.onToggle}
          aria-pressed={eliminator.on}
          aria-label="Cross out answer choices"
          className={`flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-xs transition-colors ${
            eliminator.on
              ? 'border-white bg-zinc-800 text-white'
              : 'border-[#27272A] bg-black text-zinc-400 hover:border-zinc-500 hover:text-white'
          } ${T.focus}`}
        >
          <svg
            className="h-3.5 w-6"
            viewBox="0 0 28 14"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <text
              x="1"
              y="11"
              fill="currentColor"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              stroke="none"
            >
              ABC
            </text>
            <line x1="0" y1="7" x2="26" y2="7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
