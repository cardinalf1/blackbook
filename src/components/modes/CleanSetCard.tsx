import type { CleanSetStats } from '../../services/modes/presets';
import { MISTAKE_REASONS, MISTAKE_REASON_LABEL } from '../../types/mistakes';

export interface CleanSetCardProps {
  stats: CleanSetStats;
}

export function CleanSetCard({ stats }: CleanSetCardProps) {
  return (
    <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3 text-xs text-zinc-300 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Clean in a row</span>
          <span className="text-sm font-semibold text-[#FAFAFA]">{stats.cleanStreak}</span>
          <span className="text-[10px] text-zinc-500 block">clean sets in a row</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Best streak</span>
          <span className="text-sm font-semibold text-[#FAFAFA]">{stats.bestStreak}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Sets done</span>
          <span className="text-sm font-semibold text-[#FAFAFA]">{stats.sets}</span>
        </div>
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Slips / set</span>
          <span className="text-sm font-semibold text-[#FAFAFA]">{stats.slipsPerSet.toFixed(1)}</span>
        </div>
      </div>

      <div className="border-t border-[#27272A]/70 pt-2 space-y-1">
        <span className="text-[10px] uppercase text-zinc-500 block font-mono">Slips by reason</span>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {MISTAKE_REASONS.map((reason) => {
            const count = stats.slipsByReason[reason] ?? 0;
            return (
              <span
                key={reason}
                className={`rounded px-1.5 py-0.5 font-mono ${
                  count > 0 ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900/40 text-zinc-600'
                }`}
              >
                {MISTAKE_REASON_LABEL[reason]}: {count}
              </span>
            );
          })}
          <span
            className={`rounded px-1.5 py-0.5 font-mono ${
              stats.untagged > 0 ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900/40 text-zinc-600'
            }`}
          >
            untagged: {stats.untagged}
          </span>
        </div>
      </div>
    </div>
  );
}
