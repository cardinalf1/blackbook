import clsx from 'clsx';
import type { MistakesCardProps } from '../../types/dashboard';
import { MISTAKE_REASONS, MISTAKE_REASON_LABEL } from '../../types/mistakes';
import { T } from '../ui/tokens';

export function MistakesCard({ mistakes, onAction, onTagSession, onLink }: MistakesCardProps) {
  const uniqueWeeks = Array.from(new Set(mistakes.reasonsTrend.map((r) => r.week))).sort();
  const showTrend = uniqueWeeks.length >= 2;

  const trendLookup = new Map<string, number>();
  if (showTrend) {
    for (const item of mistakes.reasonsTrend) {
      trendLookup.set(`${item.week}:${item.reason}`, item.count);
    }
  }

  return (
    <section className={clsx(T.card, T.cardPad, 'space-y-6')} aria-label="Mistakes card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className={T.title}>Mistakes</h2>
          <span className={T.muted}>From your own tags.</span>
        </div>
        <button
          type="button"
          onClick={() => onLink({ to: 'mistakes' })}
          className={T.linkMuted}
        >
          Open the mistake log
        </button>
      </div>

      {/* Reasons breakdown */}
      {mistakes.tagged === 0 ? (
        <div className="space-y-2">
          <p className={T.body}>Tag the misses from your last session to see why you miss.</p>
          {mistakes.untaggedLast ? (
            <button
              type="button"
              onClick={() => onTagSession(mistakes.untaggedLast!.sessionId)}
              className={T.secondary}
            >
              Tag {mistakes.untaggedLast.untagged} misses from last session
            </button>
          ) : (
            <p className={T.muted}>No misses to tag yet.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className={T.label}>Reasons breakdown</span>
            <span className={clsx(T.muted, T.num)}>
              {mistakes.tagged} of {mistakes.misses} misses tagged
            </span>
          </div>

          <div className="space-y-2">
            {MISTAKE_REASONS.map((reason) => {
              const count = mistakes.reasons[reason] ?? 0;
              const maxCount = Math.max(
                ...MISTAKE_REASONS.map((r) => mistakes.reasons[r] ?? 0),
                1,
              );
              const pct = (count / maxCount) * 100;

              return (
                <div key={reason} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-zinc-200">{MISTAKE_REASON_LABEL[reason]}</span>
                    <span className="tabular-nums text-zinc-400">
                      {count} (N = {mistakes.tagged})
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-[1px] border border-[#27272A] bg-[#0A0A0C]">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reasons trend (2+ weeks only) */}
      {showTrend && (
        <div className="space-y-2 border-t border-[#27272A] pt-4">
          <div className={T.label}>Reasons trend</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#27272A] text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]">
                  <th className="border-r border-[#27272A] p-2 text-zinc-400">Week</th>
                  {MISTAKE_REASONS.map((reason) => (
                    <th
                      key={reason}
                      className="border-r border-[#27272A] p-2 text-zinc-400 last:border-r-0"
                    >
                      {MISTAKE_REASON_LABEL[reason]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueWeeks.map((week) => (
                  <tr key={week} className="border-b border-[#27272A] last:border-b-0">
                    <td className="border-r border-[#27272A] p-2 text-zinc-300">{week}</td>
                    {MISTAKE_REASONS.map((reason) => (
                      <td
                        key={reason}
                        className="border-r border-[#27272A] p-2 tabular-nums text-zinc-400 last:border-r-0"
                      >
                        {trendLookup.get(`${week}:${reason}`) ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Retry progress */}
      <div className="space-y-2 border-t border-[#27272A] pt-4">
        <div className={T.label}>Retry progress</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={clsx(T.body, T.num)}>
            {mistakes.retry.due} due now, {mistakes.retry.queued} in the queue,{' '}
            {mistakes.retry.correct} of {mistakes.retry.answered} retries right
          </p>
          {mistakes.retry.due > 0 && (
            <button
              type="button"
              onClick={() => onAction({ kind: 'retry', label: 'Retry due questions' })}
              className={T.secondary}
            >
              Retry due questions
            </button>
          )}
        </div>
      </div>

      {/* Slips in 800 modes */}
      <div className="space-y-2 border-t border-[#27272A] pt-4">
        <div className={T.label}>Slips in 800 modes</div>
        {mistakes.slips800.length === 0 ? (
          <p className={T.muted}>No 800 mode sets yet.</p>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {mistakes.slips800.map((slip) => (
              <div
                key={slip.preset}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#27272A] py-1.5 last:border-b-0"
              >
                <span className="font-semibold text-white">{slip.title}</span>
                <div className="flex flex-wrap items-center gap-3 tabular-nums text-zinc-400">
                  <span>
                    {slip.sets} {slip.sets === 1 ? 'set' : 'sets'}
                  </span>
                  <span>{slip.cleanSets} clean</span>
                  <span>streak {slip.cleanStreak}</span>
                  <span>{slip.slipsPerSet.toFixed(1)} slips/set</span>
                  <span>{slip.untagged} untagged</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review buttons */}
      {mistakes.reviewDrills.length > 0 && (
        <div className="flex flex-wrap gap-2.5 border-t border-[#27272A] pt-4">
          {mistakes.reviewDrills.map((rd) => {
            const sectionName = rd.section === 'rw' ? 'Reading and Writing' : 'Math';
            const label = `Review ${rd.available} missed ${sectionName} questions`;
            return (
              <button
                key={rd.section}
                type="button"
                onClick={() => onAction({ kind: 'drill', label, config: rd.config })}
                className={T.secondary}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
