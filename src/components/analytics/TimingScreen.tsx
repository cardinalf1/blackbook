// Timing and pacing screen: baselines, mean time by difficulty, flagged behavior questions,
// and exam module pacing. Drill and exam numbers are kept strictly in separate sections.

import { useState } from 'react';
import {
  MIN_BASELINE_ATTEMPTS,
  RUSH_PERCENTILE,
  STUCK_PERCENTILE,
} from '../../config/analyticsConfig';
import { DIFFICULTIES, type Difficulty, type Section } from '../../types/sat';
import type {
  FlaggedQuestion,
  ModulePacing,
  TimingBaseline,
  TimingScreenProps,
} from '../../types/analytics';
import { formatDuration } from '../../utils/formatDuration';
import { ColumnGroups } from './charts/ColumnGroups';
import { HBar } from './charts/HBar';

const difficultyLabel = (d: Difficulty): string =>
  d === 'E' ? 'Easy' : d === 'M' ? 'Medium' : 'Hard';

const sectionLabel = (s: Section): string =>
  s === 'rw' ? 'Reading and Writing' : 'Math';

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function TimingScreen({ summary, skillName }: TimingScreenProps) {
  const [selectedSection, setSelectedSection] = useState<'both' | Section>('both');

  const drillBaselines = summary.baselines.filter((b) => b.mode === 'drill');
  const examBaselines = summary.baselines.filter((b) => b.mode === 'exam');

  const renderBaselineTable = (baselines: TimingBaseline[], modeTitle: string) => {
    return (
      <div className="space-y-2">
        <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-300">
          {modeTitle}
        </h3>
        {baselines.length === 0 ? (
          <p className="text-xs text-zinc-500">No baseline data yet for {modeTitle.toLowerCase()}.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#27272A] bg-[#121215]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-zinc-400">
                  <th className="px-3 py-2 font-medium">Section</th>
                  <th className="px-3 py-2 font-medium">Difficulty</th>
                  <th className="px-3 py-2 font-medium">N</th>
                  <th className="px-3 py-2 font-medium">Median</th>
                  <th className="px-3 py-2 font-medium">Rushed below</th>
                  <th className="px-3 py-2 font-medium">Stuck above</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A] font-mono text-zinc-300">
                {baselines.map((b, idx) => (
                  <tr key={`${b.mode}-${b.section}-${b.difficulty}-${idx}`} className="hover:bg-zinc-800/30">
                    <td className="px-3 py-2 text-zinc-200">{sectionLabel(b.section)}</td>
                    <td className="px-3 py-2">{difficultyLabel(b.difficulty)}</td>
                    <td className="px-3 py-2">{b.n}</td>
                    <td className="px-3 py-2">{b.n > 0 ? formatDuration(b.medianMs) : '—'}</td>
                    {b.usable ? (
                      <>
                        <td className="px-3 py-2 text-zinc-200">{formatDuration(b.rushMs)}</td>
                        <td className="px-3 py-2 text-zinc-200">{formatDuration(b.stuckMs)}</td>
                      </>
                    ) : (
                      <td colSpan={2} className="px-3 py-2 text-zinc-500 italic">
                        not enough data ({b.n} of {MIN_BASELINE_ATTEMPTS} needed)
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Prepare ColumnGroups data
  const buildSectionGroupData = (sec: Section) => {
    return DIFFICULTIES.map((diff) => {
      const drill = drillBaselines.find((b) => b.section === sec && b.difficulty === diff);
      const exam = examBaselines.find((b) => b.section === sec && b.difficulty === diff);
      const drillMean = drill && drill.n > 0 ? drill.timeMs / drill.n : 0;
      const examMean = exam && exam.n > 0 ? exam.timeMs / exam.n : 0;

      return {
        id: diff,
        label: difficultyLabel(diff),
        data: [
          {
            seriesId: 'drill',
            value: drillMean,
            valueText: drill && drill.n > 0 ? formatDuration(drillMean) : '—',
          },
          {
            seriesId: 'exam',
            value: examMean,
            valueText: exam && exam.n > 0 ? formatDuration(examMean) : '—',
          },
        ],
      };
    });
  };

  const chartSeries = [
    { id: 'drill', label: 'Drills', pattern: 'solid' as const },
    { id: 'exam', label: 'Exam modules', pattern: 'striped' as const },
  ];

  return (
    <div className="space-y-8 text-[#FAFAFA]">
      {/* (a) Your timing baselines */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">Your timing baselines</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Thresholds are percentiles ({RUSH_PERCENTILE}th percentile for rushed, {STUCK_PERCENTILE}th percentile for stuck) of your own time for that mode, section and difficulty.
          </p>
        </div>

        <div className="space-y-6">
          {renderBaselineTable(drillBaselines, 'Drills')}
          {renderBaselineTable(examBaselines, 'Exam modules')}
        </div>
      </section>

      {/* (b) Mean time per answer by difficulty */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm font-semibold text-zinc-100">Mean time per answer</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Average seconds spent per question by difficulty, comparing Drills and Exam modules.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-[#27272A] bg-[#0A0A0C] p-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setSelectedSection('both')}
              className={`rounded px-2.5 py-1 transition-colors ${
                selectedSection === 'both' ? 'bg-[#27272A] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Both sections
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('rw')}
              className={`rounded px-2.5 py-1 transition-colors ${
                selectedSection === 'rw' ? 'bg-[#27272A] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Reading and Writing
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('math')}
              className={`rounded px-2.5 py-1 transition-colors ${
                selectedSection === 'math' ? 'bg-[#27272A] text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Math
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(selectedSection === 'both' || selectedSection === 'rw') && (
            <div className="rounded border border-[#27272A] bg-[#0A0A0C]/50 p-4 space-y-2">
              <h3 className="font-mono text-xs font-medium text-zinc-300">Reading and Writing</h3>
              <ColumnGroups
                label="Reading and Writing mean time per answer by difficulty"
                groups={buildSectionGroupData('rw')}
                series={chartSeries}
                formatValue={(ms) => formatDuration(ms)}
              />
            </div>
          )}

          {(selectedSection === 'both' || selectedSection === 'math') && (
            <div className="rounded border border-[#27272A] bg-[#0A0A0C]/50 p-4 space-y-2">
              <h3 className="font-mono text-xs font-medium text-zinc-300">Math</h3>
              <ColumnGroups
                label="Math mean time per answer by difficulty"
                groups={buildSectionGroupData('math')}
                series={chartSeries}
                formatValue={(ms) => formatDuration(ms)}
              />
            </div>
          )}
        </div>
      </section>

      {/* (c) Flagged questions */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">Flagged questions</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Questions outside your typical timing baseline. Descriptions indicate behavioral pacing only.
          </p>
        </div>

        {/* Flagged counts overview */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
          <div className="rounded border border-[#27272A] bg-[#0A0A0C]/60 p-3 space-y-1">
            <span className="text-zinc-500">Drills · fast & wrong</span>
            <div className="text-lg font-semibold text-zinc-100">
              {summary.flaggedCounts.rushedWrong.drill}
            </div>
            <span className="text-[11px] text-zinc-400">answered fast and wrong</span>
          </div>
          <div className="rounded border border-[#27272A] bg-[#0A0A0C]/60 p-3 space-y-1">
            <span className="text-zinc-500">Drills · unusually long</span>
            <div className="text-lg font-semibold text-zinc-100">
              {summary.flaggedCounts.stuck.drill}
            </div>
            <span className="text-[11px] text-zinc-400">took unusually long</span>
          </div>
          <div className="rounded border border-[#27272A] bg-[#0A0A0C]/60 p-3 space-y-1">
            <span className="text-zinc-500">Exams · fast & wrong</span>
            <div className="text-lg font-semibold text-zinc-100">
              {summary.flaggedCounts.rushedWrong.exam}
            </div>
            <span className="text-[11px] text-zinc-400">answered fast and wrong</span>
          </div>
          <div className="rounded border border-[#27272A] bg-[#0A0A0C]/60 p-3 space-y-1">
            <span className="text-zinc-500">Exams · unusually long</span>
            <div className="text-lg font-semibold text-zinc-100">
              {summary.flaggedCounts.stuck.exam}
            </div>
            <span className="text-[11px] text-zinc-400">took unusually long</span>
          </div>
        </div>

        {/* Flagged list */}
        {summary.flagged.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">No flagged questions in this view.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[#27272A] bg-[#121215]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-zinc-400">
                  <th className="px-3 py-2 font-medium">Skill</th>
                  <th className="px-3 py-2 font-medium">Difficulty</th>
                  <th className="px-3 py-2 font-medium">Flag</th>
                  <th className="px-3 py-2 font-medium">Time vs threshold</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A] font-mono text-zinc-300">
                {summary.flagged.map((f: FlaggedQuestion, i: number) => {
                  const behaviorLabel =
                    f.flag === 'rushed_wrong' ? 'answered fast and wrong' : 'took unusually long';
                  return (
                    <tr key={`${f.questionId}-${f.at}-${i}`} className="hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-zinc-200">
                        {skillName(f.skillCode)} <span className="text-zinc-500">({f.skillCode})</span>
                      </td>
                      <td className="px-3 py-2">{difficultyLabel(f.difficulty)}</td>
                      <td className="px-3 py-2 text-amber-300">{behaviorLabel}</td>
                      <td className="px-3 py-2">
                        {formatDuration(f.timeMs)}{' '}
                        <span className="text-zinc-500">vs threshold {formatDuration(f.thresholdMs)}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        <span className={f.correct ? 'text-emerald-400' : 'text-rose-400'}>
                          {f.correct ? 'right' : 'wrong'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{f.mode === 'drill' ? 'Drills' : 'Exam modules'}</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(f.at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* (d) Exam module pacing */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">Exam module pacing</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Time remaining at the end of each module and activity during the final minutes.
          </p>
        </div>

        {summary.modules.length === 0 ? (
          <p className="text-xs text-zinc-500">No exam modules in this view yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Visual HBar representation of timeLeftMs */}
            <div className="rounded border border-[#27272A] bg-[#0A0A0C]/50 p-4 space-y-3">
              <h3 className="font-mono text-xs font-medium text-zinc-300">Time left by module</h3>
              <HBar
                label="Module time left"
                items={summary.modules.map((m: ModulePacing) => {
                  const title = `Section ${m.section === 'rw' ? '1' : '2'}, Module ${m.moduleNumber}`;
                  return {
                    id: m.sessionId,
                    label: `${title} (${m.tier})`,
                    value: m.timeLeftMs,
                    valueText: `${formatDuration(m.timeLeftMs)} left`,
                    subtext: `${formatDate(m.finishedAt)} · ${m.submittedBy === 'user' ? 'submitted by you' : 'submitted by the timer'}${m.paused ? ' · paused' : ''}`,
                  };
                })}
              />
            </div>

            {/* Detailed module pacing table */}
            <div className="overflow-x-auto rounded-md border border-[#27272A] bg-[#121215]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-zinc-400">
                    <th className="px-3 py-2 font-medium">Module</th>
                    <th className="px-3 py-2 font-medium">Tier</th>
                    <th className="px-3 py-2 font-medium">Submission</th>
                    <th className="px-3 py-2 font-medium">Time left</th>
                    <th className="px-3 py-2 font-medium">Last 5 minutes</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A] font-mono text-zinc-300">
                  {summary.modules.map((m: ModulePacing) => {
                    const title = `Section ${m.section === 'rw' ? '1' : '2'}, Module ${m.moduleNumber}`;
                    const submissionText =
                      m.submittedBy === 'user' ? 'submitted by you' : 'submitted by the timer';
                    const fiveMinText = m.reachedFiveMinutes
                      ? `answered ${m.answeredInLastFive} of ${m.questions} questions in the last five minutes`
                      : 'ended before the five-minute alert';

                    return (
                      <tr key={m.sessionId} className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 text-zinc-200">
                          <span className="font-medium">{title}</span>
                          {m.paused && (
                            <span className="ml-2 inline-block rounded bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.2 text-[10px] text-amber-300 font-sans">
                              paused
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-400 capitalize">{m.tier}</td>
                        <td className="px-3 py-2">{submissionText}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-200">
                          {formatDuration(m.timeLeftMs)}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{fiveMinText}</td>
                        <td className="px-3 py-2 text-zinc-500">{formatDate(m.finishedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
