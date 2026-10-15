import { averageMs, describeRate, rateView } from '../../services/analytics/metrics';
import type { OverviewScreenProps, OverviewSummary } from '../../types/analytics';
import type { SessionMode } from '../../types/session';
import type { TestKind } from '../../types/test';
import { formatDuration } from '../../utils/formatDuration';
import { TrendChart, type TrendPoint, type TrendSeries } from './charts/TrendChart';

export function formatStudyTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }
  return `${minutes} min`;
}

function dayToLocalMidnight(dayStr: string): number {
  const parts = dayStr.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function formatTestKind(kind: TestKind): string {
  switch (kind) {
    case 'full':
      return 'Full test';
    case 'rw':
      return 'Reading and Writing section';
    case 'math':
      return 'Math section';
  }
}

interface ModeCardProps {
  title: string;
  sessions: number;
  attempts: number;
  correct: number;
  timeMs: number;
  activeMs: number;
}

function ModeCard({ title, sessions, attempts, correct, timeMs, activeMs }: ModeCardProps) {
  const rate = rateView(correct, attempts);
  const avgTime = averageMs({ attempts, correct, timeMs });

  return (
    <section className="flex flex-col justify-between rounded-lg border border-[#27272A] bg-[#121215] p-5">
      <div>
        <h3 className="font-mono text-sm font-medium text-zinc-100">{title}</h3>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-zinc-400">Sessions</dt>
            <dd className="mt-1 font-mono text-base text-zinc-100">{sessions}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Answered questions</dt>
            <dd className="mt-1 font-mono text-base text-zinc-100">{attempts}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Accuracy</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-100">{describeRate(rate)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Average time per answer</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-100">
              {formatDuration(avgTime ?? 0)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-zinc-400">Active study time</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-100">{formatStudyTime(activeMs)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function buildTrendSeries(daily: OverviewSummary['daily']): TrendSeries[] {
  const modes: { mode: SessionMode; id: string; label: string }[] = [
    { mode: 'drill', id: 'drill', label: 'Drills' },
    { mode: 'exam', id: 'exam', label: 'Exam modules' },
  ];

  const series: TrendSeries[] = [];

  for (const { mode, id, label } of modes) {
    const modePoints = daily
      .filter((d) => d.mode === mode && d.attempts > 0)
      .map((d): TrendPoint => ({
        x: dayToLocalMidnight(d.day),
        y: d.attempts > 0 ? d.correct / d.attempts : 0,
        n: d.attempts,
      }))
      .sort((a, b) => a.x - b.x);

    if (modePoints.length > 0) {
      series.push({ id, label, points: modePoints });
    }
  }

  return series;
}

export function OverviewScreen({ summary, latestTests }: OverviewScreenProps) {
  const totalAttempts = summary.attempts.drill.attempts + summary.attempts.exam.attempts;

  if (totalAttempts === 0) {
    return (
      <div className="space-y-6 text-[#FAFAFA]">
        <section className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center">
          <p className="text-sm text-zinc-400">No finished drills or exam modules in this view yet.</p>
        </section>
        <div className="text-xs text-zinc-400">
          {summary.bank.seen} of {summary.bank.total} questions seen ({summary.bank.seenLive} of {summary.bank.live} live)
        </div>
        {summary.unattributed > 0 && (
          <div className="text-xs text-zinc-500">
            {summary.unattributed} {summary.unattributed === 1 ? 'answer is' : 'answers are'} on questions no longer in the bank and are left out.
          </div>
        )}
      </div>
    );
  }

  const series = buildTrendSeries(summary.daily);
  const newestTests = [...latestTests]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, 3);

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModeCard
          title="Drills"
          sessions={summary.sessions.drill}
          attempts={summary.attempts.drill.attempts}
          correct={summary.attempts.drill.correct}
          timeMs={summary.attempts.drill.timeMs}
          activeMs={summary.activeMs.drill}
        />
        <ModeCard
          title="Exam modules"
          sessions={summary.sessions.exam}
          attempts={summary.attempts.exam.attempts}
          correct={summary.attempts.exam.correct}
          timeMs={summary.attempts.exam.timeMs}
          activeMs={summary.activeMs.exam}
        />
      </div>

      <div className="space-y-1 text-xs text-zinc-400">
        <p>
          {summary.bank.seen} of {summary.bank.total} questions seen ({summary.bank.seenLive} of {summary.bank.live} live)
        </p>
        {summary.unattributed > 0 && (
          <p className="text-zinc-500">
            {summary.unattributed} {summary.unattributed === 1 ? 'answer is' : 'answers are'} on questions no longer in the bank and are left out.
          </p>
        )}
      </div>

      <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <h3 className="font-mono text-sm font-medium text-zinc-100">Accuracy over time</h3>
        <TrendChart series={series} label="Accuracy over time" />
      </section>

      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <h3 className="font-mono text-sm font-medium text-zinc-100">Latest test estimates</h3>
        {newestTests.length === 0 ? (
          <p className="text-xs text-zinc-500">No test estimates yet.</p>
        ) : (
          <div className="space-y-3">
            {newestTests.map((t) => (
              <div
                key={t.testId}
                className="space-y-2 rounded border border-[#27272A] bg-[#0A0A0C] p-4 text-xs text-zinc-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">{formatTestKind(t.kind)}</span>
                    {t.paused && (
                      <span className="rounded border border-amber-800/60 bg-amber-950/60 px-1.5 py-0.5 text-[11px] text-amber-300">
                        paused
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
                    <span>
                      {new Date(t.finishedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>scoring v{t.configVersion}</span>
                  </div>
                </div>

                {t.estimate && (
                  <div className="space-y-1.5 pt-1">
                    {t.estimate.total && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-zinc-200">Total:</span>
                        <span className="font-mono text-zinc-100">
                          {t.estimate.total.low} to {t.estimate.total.high}
                        </span>
                        <span className="text-zinc-400">estimate</span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          (about {t.estimate.total.mid})
                        </span>
                      </div>
                    )}
                    {t.estimate.sections.map((sec) => (
                      <div key={sec.section} className="flex items-baseline gap-2">
                        <span className="text-zinc-400">
                          {sec.section === 'rw' ? 'Reading and Writing' : 'Math'}:
                        </span>
                        <span className="font-mono text-zinc-200">
                          {sec.low} to {sec.high}
                        </span>
                        <span className="text-zinc-400">estimate</span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          (about {sec.mid})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
