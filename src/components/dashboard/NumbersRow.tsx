import type { NumbersRowProps } from '../../types/dashboard';
import { T } from '../ui/tokens';

function formatPace(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function NumbersRow({ numbers }: NumbersRowProps) {
  const { estimate, firstAttempt, questionsDone, freshTests, studyWeek, pace } = numbers;

  const firstAttemptPct =
    firstAttempt.attempts > 0
      ? Math.round((firstAttempt.correct / firstAttempt.attempts) * 100)
      : 0;

  const studyMinutes = Math.round(studyWeek.activeMs / 60000);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {/* (a) Estimated score range */}
      <div className={`${T.card} p-4 space-y-2 flex flex-col justify-between`}>
        <div className="space-y-2">
          <span className={T.label}>Estimated score</span>
          {estimate ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={T.bigNum}
                  title={`Scoring config version ${estimate.configVersion}`}
                >
                  {estimate.low}–{estimate.high}
                </span>
                <span className={T.tag}>approximation</span>
              </div>
              <div className={T.muted}>
                {new Date(estimate.finishedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          ) : (
            <div className={T.muted}>No full test yet</div>
          )}
        </div>
      </div>

      {/* (b) First-attempt accuracy */}
      <div className={`${T.card} p-4 space-y-2 flex flex-col justify-between`}>
        <div className="space-y-2">
          <span className={T.label}>First-attempt accuracy</span>
          <div className="space-y-1">
            <div className={T.bigNum}>{firstAttempt.attempts > 0 ? `${firstAttemptPct}%` : '–'}</div>
            <div className={T.body}>
              {firstAttempt.attempts > 0 ? `${firstAttempt.correct} of ${firstAttempt.attempts} (${firstAttemptPct}%)` : 'No answers in this period'}
            </div>
            <div className={T.muted}>N = {firstAttempt.attempts}</div>
          </div>
        </div>

        {firstAttempt.previous !== null ? (
          <div className="font-mono text-xs text-zinc-300">
            {(() => {
              const prevPct =
                firstAttempt.previous.attempts > 0
                  ? Math.round(
                      (firstAttempt.previous.correct / firstAttempt.previous.attempts) * 100,
                    )
                  : 0;
              const diff = firstAttemptPct - prevPct;
              const sign = diff > 0 ? '+' : '';
              return `${sign}${diff} pp vs previous`;
            })()}
          </div>
        ) : (
          <div className={T.muted}>not enough data</div>
        )}
      </div>

      {/* (c) Questions done */}
      <div className={`${T.card} p-4 space-y-2 flex flex-col justify-between`}>
        <div className="space-y-2">
          <span className={T.label}>Questions done</span>
          <div className="space-y-1">
            <div className={T.bigNum}>
              {questionsDone.done} of {questionsDone.total}
            </div>
            <div className={T.body}>{questionsDone.seen} seen</div>
            <div className={T.muted}>
              {freshTests === null
                ? 'unknown'
                : freshTests.capped
                  ? 'about 50 or more full tests left (estimate)'
                  : `about ${freshTests.full} full tests left (estimate)`}
            </div>
          </div>
        </div>
      </div>

      {/* (d) Study time this week */}
      <div className={`${T.card} p-4 space-y-2 flex flex-col justify-between`}>
        <div className="space-y-2">
          <span className={T.label}>Study time this week</span>
          <div className="space-y-1">
            <div className={T.bigNum}>{studyMinutes} min</div>
            <div className={T.body}>
              {studyWeek.sessions} {studyWeek.sessions === 1 ? 'session' : 'sessions'}
            </div>
          </div>
        </div>

        {studyWeek.previousMs === null && <div className={T.muted}>not enough data</div>}
        {studyWeek.previousMs !== null && (
          <div className="font-mono text-xs text-zinc-300">
            {(() => {
              const prevMinutes = Math.round(studyWeek.previousMs / 60000);
              const diff = studyMinutes - prevMinutes;
              const sign = diff > 0 ? '+' : '';
              return `${sign}${diff} min vs previous`;
            })()}
          </div>
        )}
      </div>

      {/* (e) Average pace per section */}
      <div className={`${T.card} p-4 space-y-2 flex flex-col justify-between`}>
        <div className="space-y-2">
          <span className={T.label}>Average pace</span>
          <div className="space-y-3">
            {pace.map((item) => {
              const sectionLabel =
                item.section === 'rw' ? 'Reading and Writing' : 'Math';
              const avgPaceMs =
                item.attempts > 0 ? item.timeMs / item.attempts : 0;
              const paceStr = formatPace(avgPaceMs);
              const targetStr = formatPace(item.targetMs);

              return (
                <div key={item.section} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span>{sectionLabel}</span>
                    <span className="font-mono text-zinc-400">N = {item.attempts}</span>
                  </div>
                  <div className="font-mono text-xs text-white">
                    {item.attempts > 0 ? `${paceStr} per answer vs target ${targetStr}` : `no answers yet (target ${targetStr})`}
                  </div>
                  {item.previous !== null && item.previous.attempts > 0 && (
                    <div className="font-mono text-[11px] text-zinc-400">
                      {(() => {
                        const prevAvgPaceMs =
                          item.previous.timeMs / item.previous.attempts;
                        const diffSec = Math.round((avgPaceMs - prevAvgPaceMs) / 1000);
                        const sign = diffSec > 0 ? '+' : '';
                        return `${sign}${diffSec}s vs previous`;
                      })()}
                    </div>
                  )}
                  {item.previous === null && <div className="font-mono text-[11px] text-zinc-500">change: not enough data</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
