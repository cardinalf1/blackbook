import { useEffect, useRef, useState } from 'react';
import type { Section } from '../../types/sat';
import type { BreakdownRow, ReportItem } from '../../types/session';
import type { TestModuleReport, TestReport, TestReportProps } from '../../types/test';
import { formatDuration } from '../../utils/formatDuration';
import { MistakeReviewPanel } from '../mistakes/MistakeReviewPanel';
import { QuestionHtml } from '../QuestionHtml';

const SECTION_LABELS: Record<Section, string> = {
  rw: 'Reading and Writing',
  math: 'Math',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  guess: 'Guess',
  unsure: 'Unsure',
  sure: 'Sure',
};

function getHeading(kind: TestReport['kind']): string {
  switch (kind) {
    case 'full':
      return 'Full test report';
    case 'rw':
      return 'Reading and Writing section report';
    case 'math':
      return 'Math section report';
  }
}

function BreakdownSection({
  byDomain,
  bySkill,
}: {
  byDomain: readonly BreakdownRow[];
  bySkill: readonly BreakdownRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
        <div className="border-b border-[#27272A] px-5 py-3">
          <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400">By domain</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                <th className="px-3 py-2.5">Domain</th>
                <th className="px-3 py-2.5">Score</th>
                <th className="px-3 py-2.5">Accuracy</th>
                <th className="px-3 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {byDomain.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-zinc-500">
                    No domain data.
                  </td>
                </tr>
              ) : (
                byDomain.map((row) => {
                  const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                  return (
                    <tr key={row.code} className="border-b border-[#27272A] text-xs text-zinc-300">
                      <td className="px-3 py-2.5 text-zinc-200">{row.label}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">
                        {row.correct} / {row.total}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{pct}%</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {formatDuration(row.activeMs)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215]">
        <div className="border-b border-[#27272A] px-5 py-3">
          <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400">By skill</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#27272A] bg-[#0A0A0C]/60 font-mono text-xs text-zinc-400">
                <th className="px-3 py-2.5">Skill</th>
                <th className="px-3 py-2.5">Score</th>
                <th className="px-3 py-2.5">Accuracy</th>
                <th className="px-3 py-2.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {bySkill.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-zinc-500">
                    No skill data.
                  </td>
                </tr>
              ) : (
                bySkill.map((row) => {
                  const pct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                  return (
                    <tr key={row.code} className="border-b border-[#27272A] text-xs text-zinc-300">
                      <td className="px-3 py-2.5 text-zinc-200">{row.label}</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">
                        {row.correct} / {row.total}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-300">{pct}%</td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {formatDuration(row.activeMs)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function QuestionItemView({
  item,
  isOpen,
  onToggle,
}: {
  item: ReportItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const difficultyLabel = DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty;
  const hasDiffFirstVisit =
    item.firstVisitMs !== null &&
    formatDuration(item.firstVisitMs) !== formatDuration(item.activeMs);

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#0A0A0C] p-4 text-xs transition-colors">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold text-zinc-300">{item.index + 1}</span>
            <span className="font-mono text-zinc-400">#{item.displayId}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-200">{item.skill}</span>
            <span className="text-zinc-500">•</span>
            <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
              {difficultyLabel}
            </span>
            {item.correct ? (
              <span className="rounded border border-emerald-800/60 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                Correct
              </span>
            ) : (
              <span className="rounded border border-red-800/60 bg-red-950/60 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                Missed
              </span>
            )}
            {item.flagged && (
              <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                Flagged
              </span>
            )}
            {item.confidence !== null && (
              <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                {CONFIDENCE_LABELS[item.confidence] ?? item.confidence}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span>Your answer:</span>
              <span className="font-mono font-medium text-zinc-200">{item.response ?? '—'}</span>
              {item.response === null && (
                <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  Unanswered
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Correct answer:</span>
              <span className="font-mono font-medium text-zinc-200">{item.correctAnswer}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Time:</span>
              <span className="font-mono text-zinc-300">{formatDuration(item.activeMs)}</span>
              {hasDiffFirstVisit && (
                <span className="text-zinc-500">
                  (first visit {formatDuration(item.firstVisitMs as number)})
                </span>
              )}
            </div>
            {item.changes > 0 && <span className="text-zinc-400">changed {item.changes}×</span>}
          </div>
        </div>

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="self-start rounded-md border border-[#27272A] px-3 py-1.5 text-xs text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 sm:self-auto"
        >
          {isOpen ? 'Hide explanation' : 'Show explanation'}
        </button>
      </div>

      {/* Expanded explanation */}
      {isOpen && (
        <div className="mt-4 border-t border-[#27272A] pt-4">
          {item.question === null ? (
            <p className="text-zinc-400">This question is no longer in your question bank.</p>
          ) : (
            <div className="space-y-4">
              {item.question.stimulusHtml && (
                <QuestionHtml html={item.question.stimulusHtml} className="text-zinc-300" />
              )}
              <QuestionHtml html={item.question.stemHtml} className="text-zinc-100" />

              {item.question.answer.kind === 'mcq' && (
                <div className="space-y-2">
                  {item.question.answer.choices.map((choice, i) => {
                    const letter =
                      (['A', 'B', 'C', 'D'] as const)[i] ?? String.fromCharCode(65 + i);
                    const isCorrect =
                      item.question?.answer.kind === 'mcq' &&
                      item.question.answer.correct === letter;
                    const isUserPick = item.response === letter;
                    const isWrongPick = isUserPick && !isCorrect;

                    let borderClass = 'border-[#27272A] bg-[#121215] text-zinc-300';
                    if (isCorrect) {
                      borderClass = 'border-emerald-600 bg-emerald-950/20 text-zinc-100';
                    } else if (isWrongPick) {
                      borderClass = 'border-red-600 bg-red-950/20 text-zinc-100';
                    }

                    return (
                      <div
                        key={letter}
                        className={`flex items-start gap-2.5 rounded-md border p-3 ${borderClass}`}
                      >
                        <span className="font-mono font-semibold text-zinc-400">{letter}.</span>
                        <QuestionHtml html={choice} className="flex-1" />
                      </div>
                    );
                  })}
                </div>
              )}

              {item.question.answer.kind === 'spr' && (
                <div className="rounded-md border border-[#27272A] bg-[#121215] p-3 text-zinc-300">
                  <span className="font-semibold text-zinc-200">Accepted answers: </span>
                  <span className="font-mono text-zinc-100">
                    {item.question.answer.accepted.join(', ')}
                  </span>
                </div>
              )}

              <div className="border-t border-[#27272A] pt-3">
                <h5 className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
                  Explanation
                </h5>
                {item.question.answer.kind === 'mcq' &&
                  item.question.answer.keyOrigin === 'rationale' && (
                    <p className="mb-2 text-xs text-amber-400">
                      The answer key for this older question was read from its explanation text.
                    </p>
                  )}
                <QuestionHtml html={item.question.rationaleHtml} className="text-zinc-300" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleReportView({
  module,
  openIds,
  onToggleRow,
}: {
  module: TestModuleReport;
  openIds: Set<string>;
  onToggleRow: (questionId: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'missed' | 'flagged'>('all');

  const filteredItems = module.report.items.filter((item) => {
    if (filter === 'missed') {
      return !item.correct;
    }
    if (filter === 'flagged') {
      return item.flagged;
    }
    return true;
  });

  return (
    <div className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3">
        <div>
          <h4 className="font-mono text-sm font-semibold text-zinc-100">{module.title}</h4>
          <p className="mt-0.5 font-mono text-xs text-zinc-400">
            {module.correct} of {module.total} correct
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {module.submittedBy === 'timer' && (
            <span className="rounded border border-amber-800/60 bg-amber-950/60 px-2 py-0.5 font-mono text-xs text-amber-300">
              Submitted by timer
            </span>
          )}
        </div>
      </div>

      {module.pauses.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-800/60 bg-amber-950/40 p-3.5 text-xs text-amber-300">
          <div className="font-semibold text-amber-200">
            Paused: this is not a clean timed run.
          </div>
          <ul className="space-y-1">
            {module.pauses.map((pause, idx) => {
              const timeStr = new Date(pause.at).toLocaleTimeString();
              const durationStr =
                pause.resumedAt !== null
                  ? formatDuration(pause.resumedAt - pause.at)
                  : 'not resumed';
              return (
                <li key={idx} className="font-mono text-xs text-amber-300/90">
                  {timeStr} • {pause.reason} • {durationStr}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="font-mono text-zinc-300">
          Time used: {formatDuration(module.timeUsedMs)} of {formatDuration(module.timeLimitMs)} •{' '}
          {formatDuration(module.timeLeftMs)} left
        </div>
      </div>

      {/* Mistake review panel */}
      <MistakeReviewPanel report={module.report} source="exam" />

      {/* Filter and questions list */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h5 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Questions ({filteredItems.length})
          </h5>
          <div className="flex items-center gap-2">
            {(['all', 'missed', 'flagged'] as const).map((mode) => {
              const label = mode === 'all' ? 'All' : mode === 'missed' ? 'Missed' : 'Flagged';
              const isActive = filter === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilter(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    isActive
                      ? 'border border-zinc-500 bg-zinc-800 text-zinc-100'
                      : 'border border-[#27272A] bg-[#0A0A0C] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-[#27272A] bg-[#0A0A0C] p-6 text-center text-xs text-zinc-500">
            No questions match the current filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <QuestionItemView
                key={item.questionId}
                item={item}
                isOpen={openIds.has(item.questionId)}
                onToggle={() => onToggleRow(item.questionId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TestReportView({
  report,
  onItemToggle,
  onBack,
  onMySkills,
}: TestReportProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const openRef = useRef(openIds);
  const onItemToggleRef = useRef(onItemToggle);

  useEffect(() => {
    onItemToggleRef.current = onItemToggle;
  }, [onItemToggle]);

  useEffect(() => {
    return () => {
      for (const id of openRef.current) {
        onItemToggleRef.current(id, false);
      }
    };
  }, []);

  const toggleRow = (questionId: string) => {
    const next = new Set(openRef.current);
    const opening = !next.has(questionId);
    if (opening) {
      next.add(questionId);
    } else {
      next.delete(questionId);
    }
    openRef.current = next;
    setOpenIds(next);
    onItemToggle(questionId, opening);
  };

  const formattedDate = new Date(report.finishedAt ?? report.startedAt).toLocaleString();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 text-[#FAFAFA]">
      {/* 1. Header card */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#27272A] pb-3 sm:pb-4">
          <div>
            <h1 className="font-mono text-base font-semibold text-zinc-100">
              {getHeading(report.kind)}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-400">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMySkills}
              className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              My skills
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              Back to home
            </button>
          </div>
        </div>

        {report.paused && (
          <div className="rounded-md border border-amber-800/60 bg-amber-950/40 p-3 text-xs text-amber-300">
            This test included an emergency pause.
          </div>
        )}
      </section>

      {/* 2. Estimate block */}
      {report.estimate && (
        <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              Estimated range, an approximation
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.estimate.sections.map((secEst) => {
              const label = SECTION_LABELS[secEst.section];
              return (
                <div
                  key={secEst.section}
                  className="flex flex-col justify-between rounded-md border border-[#27272A] bg-[#0A0A0C] p-4"
                >
                  <div>
                    <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                      {label}: {secEst.low} to {secEst.high}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-zinc-400">
                      midpoint about {secEst.mid}
                    </div>
                  </div>
                  {secEst.capped && (
                    <div className="mt-3 rounded border border-amber-800/60 bg-amber-950/40 p-2 text-xs text-amber-300">
                      The easier second module limits the top of this range.
                    </div>
                  )}
                </div>
              );
            })}

            {report.kind === 'full' && report.estimate.total && (
              <div className="flex flex-col justify-between rounded-md border border-[#27272A] bg-[#0A0A0C] p-4">
                <div>
                  <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">
                    Total: {report.estimate.total.low} to {report.estimate.total.high}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-zinc-400">
                    midpoint about {report.estimate.total.mid}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#27272A] pt-3 text-xs text-zinc-400">
            <p>
              How this is calculated: your answers are weighted by question difficulty, routing to
              the easier or harder Module 2 sets which part of the scale your result falls in, and the
              range gets wider when fewer questions were answered. It is not an official score.
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
              Estimate model v{report.estimate.configVersion}
            </p>
          </div>
        </section>
      )}

      {/* 3 & 4. Per section: routing outcome, accuracy tables, modules */}
      {report.sections.map((section) => {
        const label = SECTION_LABELS[section.section];
        return (
          <section key={section.section} className="space-y-6">
            <div className="space-y-2">
              <h2 className="font-mono text-base font-semibold text-zinc-100">{label}</h2>

              {section.routing && (
                <div className="rounded-md border border-[#27272A] bg-[#121215] px-4 py-2.5 font-mono text-xs text-zinc-300">
                  {section.routing.route === 'harder'
                    ? 'Routed to the harder Module 2'
                    : 'Routed to the easier Module 2'}{' '}
                  ({Math.round(section.routing.weightedFraction * 100)}% of module 1 weighted score)
                </div>
              )}
            </div>

            {/* Accuracy by domain and by skill */}
            <BreakdownSection byDomain={section.byDomain} bySkill={section.bySkill} />

            {/* Modules */}
            <div className="space-y-4">
              {section.modules.map((module) => (
                <ModuleReportView
                  key={module.key}
                  module={module}
                  openIds={openIds}
                  onToggleRow={toggleRow}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Bottom actions */}
      <div className="flex items-center justify-end gap-2 border-t border-[#27272A] pt-4">
        <button
          type="button"
          onClick={onMySkills}
          className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          My skills
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
