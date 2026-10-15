// Behavior screen: answer changes, choice swap breakdown, strike-out tool usage,
// and confidence calibration. Drills and exam modules are presented separately and never merged.
// Metric explanations describe behavior, not reasoning.

import { netChangeEffect } from '../../services/analytics/metrics';
import type { BehaviorCounts, BehaviorScreenProps } from '../../types/analytics';
import type { SessionMode } from '../../types/session';
import { HBar } from './charts/HBar';

export function BehaviorScreen({ summary }: BehaviorScreenProps) {
  const modes: { mode: SessionMode; title: string }[] = [
    { mode: 'drill', title: 'Drills' },
    { mode: 'exam', title: 'Exam modules' },
  ];

  const formatPct = (num: number, denom: number): string => {
    if (denom <= 0) return '0%';
    return `${Math.round((num / denom) * 100)}%`;
  };

  const renderModeSection = (counts: BehaviorCounts, modeTitle: string) => {
    const net = netChangeEffect({
      correctToIncorrect: counts.correctToIncorrect,
      incorrectToCorrect: counts.incorrectToCorrect,
    });
    const netFormatted = net >= 0 ? `net +${net} answers` : `net -${Math.abs(net)} answers`;

    const totalSwaps = counts.correctToIncorrect + counts.incorrectToCorrect + counts.incorrectToIncorrect;

    return (
      <div className="space-y-6 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="border-b border-[#27272A] pb-3">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-zinc-100">
            {modeTitle}
          </h2>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {counts.answered} questions answered (N = {counts.answered})
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Total questions answered in finished sessions. These counts describe behavior, not reasoning.
          </p>
        </div>

        {/* Metric 1: Answers changed */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-medium text-zinc-300">Answers changed</h3>
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C]/50 p-3">
            <div className="font-mono text-sm text-zinc-100">
              <span className="font-semibold text-zinc-100">
                {counts.questionsWithChange} of {counts.answered}
              </span>{' '}
              <span className="text-zinc-400">
                ({formatPct(counts.questionsWithChange, counts.answered)})
              </span>{' '}
              questions, <span className="text-zinc-200">{counts.changes} changes total</span>{' '}
              <span className="text-zinc-500">(N = {counts.answered})</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Counts questions where you changed answer at least once, and total changes made. These counts describe behavior, not reasoning.
            </p>
          </div>
        </div>

        {/* Metric 2: Swap breakdown */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-medium text-zinc-300">
            Choice swap breakdown on multiple-choice answers
          </h3>
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C]/50 p-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
              <div className="font-mono text-xs text-zinc-300">
                Wrong to right vs right to wrong <span className="text-zinc-500">(N = {totalSwaps})</span>
              </div>
              <div className="font-mono text-xs font-semibold text-zinc-100">
                {netFormatted}
              </div>
            </div>

            <HBar
              label={`${modeTitle} choice swap breakdown`}
              items={[
                {
                  id: 'w2r',
                  label: 'Wrong to right',
                  value: counts.incorrectToCorrect,
                  valueText: `${counts.incorrectToCorrect} answers`,
                  pattern: 'solid',
                },
                {
                  id: 'r2w',
                  label: 'Right to wrong',
                  value: counts.correctToIncorrect,
                  valueText: `${counts.correctToIncorrect} answers`,
                  pattern: 'striped',
                },
              ]}
            />

            <div className="flex items-center justify-between font-mono text-xs text-zinc-400 border-t border-[#27272A] pt-2">
              <span>Wrong to wrong</span>
              <span className="text-zinc-200">{counts.incorrectToIncorrect} answers</span>
            </div>

            <p className="text-xs text-zinc-400">
              Direct switches from one choice to another on multiple-choice questions. These counts describe behavior, not reasoning.
            </p>
          </div>
        </div>

        {/* Metric 3: Strike-out usage */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-medium text-zinc-300">Strike-out usage</h3>
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C]/50 p-3">
            <div className="font-mono text-sm text-zinc-100">
              <span className="font-semibold text-zinc-100">
                {counts.questionsWithStrike} of {counts.mcqAnswered}
              </span>{' '}
              <span className="text-zinc-400">
                ({formatPct(counts.questionsWithStrike, counts.mcqAnswered)})
              </span>{' '}
              questions, <span className="text-zinc-200">{counts.strikeActions} strike actions</span>{' '}
              <span className="text-zinc-500">(N = {counts.mcqAnswered})</span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Questions on which choices were struck out using the eliminator tool. These counts describe behavior, not reasoning.
            </p>
          </div>
        </div>

        {/* Metric 4: Confidence calibration */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-medium text-zinc-300">Confidence calibration</h3>
          <div className="rounded-md border border-[#27272A] bg-[#0A0A0C]/50 p-4">
            {counts.rated === 0 ? (
              <p className="text-xs text-zinc-400">
                The confidence question was not asked in this view.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="rounded border border-[#27272A] bg-[#121215] p-2.5 space-y-1">
                    <span className="text-zinc-400">Sure but wrong</span>
                    <div className="text-base font-semibold text-rose-400">
                      {counts.sureWrong}{' '}
                      <span className="text-[11px] font-normal text-zinc-500">(N = {counts.rated})</span>
                    </div>
                  </div>
                  <div className="rounded border border-[#27272A] bg-[#121215] p-2.5 space-y-1">
                    <span className="text-zinc-400">Guess but right</span>
                    <div className="text-base font-semibold text-emerald-400">
                      {counts.guessRight}{' '}
                      <span className="text-[11px] font-normal text-zinc-500">(N = {counts.rated})</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded border border-[#27272A]">
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#27272A] bg-[#0A0A0C]/80 text-zinc-400">
                        <th className="px-3 py-2 font-medium">Confidence</th>
                        <th className="px-3 py-2 font-medium">Right</th>
                        <th className="px-3 py-2 font-medium">Wrong</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272A] text-zinc-300">
                      <tr className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-200">Sure</td>
                        <td className="px-3 py-2">{counts.sureRight}</td>
                        <td className="px-3 py-2">{counts.sureWrong}</td>
                        <td className="px-3 py-2">{counts.sureRight + counts.sureWrong}</td>
                      </tr>
                      <tr className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-200">Unsure</td>
                        <td className="px-3 py-2">{counts.unsureRight}</td>
                        <td className="px-3 py-2">{counts.unsureWrong}</td>
                        <td className="px-3 py-2">{counts.unsureRight + counts.unsureWrong}</td>
                      </tr>
                      <tr className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-200">Guess</td>
                        <td className="px-3 py-2">{counts.guessRight}</td>
                        <td className="px-3 py-2">{counts.guessWrong}</td>
                        <td className="px-3 py-2">{counts.guessRight + counts.guessWrong}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-zinc-400">
                  Confidence self-ratings compared with question correctness (N = {counts.rated}). These counts describe behavior, not reasoning.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {modes.map(({ mode, title }) => (
          <div key={mode}>{renderModeSection(summary.counts[mode], title)}</div>
        ))}
      </div>
    </div>
  );
}
