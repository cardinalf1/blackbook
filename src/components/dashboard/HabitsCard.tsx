import clsx from 'clsx';
import type { HabitsCardProps } from '../../types/dashboard';
import { T } from '../ui/tokens';

export function HabitsCard({ habits }: HabitsCardProps) {
  // Block (a): Answer changes
  const helped =
    (habits.behavior.drill?.incorrectToCorrect ?? 0) +
    (habits.behavior.exam?.incorrectToCorrect ?? 0);
  const hurt =
    (habits.behavior.drill?.correctToIncorrect ?? 0) +
    (habits.behavior.exam?.correctToIncorrect ?? 0);
  const neutral =
    (habits.behavior.drill?.incorrectToIncorrect ?? 0) +
    (habits.behavior.exam?.incorrectToIncorrect ?? 0);
  const nChanges = helped + hurt + neutral;
  const isThinChanges = nChanges < habits.thinBelow;

  // Block (b): Rushed vs stuck
  const rushedWrong =
    (habits.flagged.rushedWrong.drill ?? 0) + (habits.flagged.rushedWrong.exam ?? 0);
  const stuck = (habits.flagged.stuck.drill ?? 0) + (habits.flagged.stuck.exam ?? 0);
  const totalAnswered = (habits.answered.drill ?? 0) + (habits.answered.exam ?? 0);
  const isThinFlagged = totalAnswered < habits.thinBelow;

  // Block (c): Last five minutes
  const nModules = habits.lastFive.modules;
  const reached = habits.lastFive.reached;
  const answeredInLastFive = habits.lastFive.answeredInLastFive;
  const isThinLastFive = nModules < habits.thinBelow;

  return (
    <section className={clsx(T.card, T.cardPad, 'space-y-6')} aria-label="Habits card">
      <div className="flex items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
        <h2 className={T.title}>Habits</h2>
      </div>

      {/* (a) Answer changes */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={clsx(T.title, 'text-zinc-200')}>Answer changes</span>
            {isThinChanges && <span className={T.tag}>thin data</span>}
          </div>
          <span className={clsx(T.muted, T.num)}>N = {nChanges}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 font-mono text-xs">
          <div className="rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-2.5">
            <div className="text-zinc-400">Helped</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{helped}</div>
            <div className="text-[11px] text-zinc-500">wrong to right</div>
          </div>
          <div className="rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-2.5">
            <div className="text-zinc-400">Hurt</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{hurt}</div>
            <div className="text-[11px] text-zinc-500">right to wrong</div>
          </div>
          <div className="rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-2.5">
            <div className="text-zinc-400">Neutral</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">{neutral}</div>
            <div className="text-[11px] text-zinc-500">wrong to wrong</div>
          </div>
        </div>
      </div>

      {/* (b) Rushed vs stuck */}
      <div className="space-y-2 border-t border-[#27272A] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={clsx(T.title, 'text-zinc-200')}>Rushed vs stuck</span>
            {isThinFlagged && <span className={T.tag}>thin data</span>}
          </div>
          <span className={clsx(T.muted, T.num)}>N = {totalAnswered}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 font-mono text-xs">
          <div className="rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-2.5">
            <div className="text-zinc-400">Rushed wrong</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
              {rushedWrong} of {totalAnswered} answered
            </div>
            <div className="text-[11px] text-zinc-500">
              wrong and much faster than your usual time
            </div>
          </div>
          <div className="rounded-[2px] border border-[#27272A] bg-[#0A0A0C] p-2.5">
            <div className="text-zinc-400">Stuck</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-white">
              {stuck} of {totalAnswered} answered
            </div>
            <div className="text-[11px] text-zinc-500">much slower than your usual time</div>
          </div>
        </div>
      </div>

      {/* (c) Last five minutes */}
      <div className="space-y-2 border-t border-[#27272A] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={clsx(T.title, 'text-zinc-200')}>Last five minutes</span>
            {isThinLastFive && <span className={T.tag}>thin data</span>}
          </div>
          <span className={clsx(T.muted, T.num)}>N = {nModules}</span>
        </div>
        {reached === 0 ? (
          <p className={T.muted}>No module reached the five-minute alert yet.</p>
        ) : (
          <p className={clsx(T.body, T.num)}>
            {answeredInLastFive} questions answered in the last five minutes over {reached} reached{' '}
            {reached === 1 ? 'module' : 'modules'}
          </p>
        )}
      </div>
    </section>
  );
}
