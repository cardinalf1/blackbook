import type { CoachCardProps } from '../../types/dashboard';
import { T } from '../ui/tokens';

export function CoachCard({ coach, ai, onAction }: CoachCardProps) {
  const showAiLines =
    !coach.unlock &&
    !coach.emptyScope &&
    ai.state === 'done' &&
    ai.lines !== null &&
    ai.lines.length > 0;

  const originLabel = showAiLines ? 'AI-assisted' : 'rule-based';

  return (
    <div className={`${T.card} ${T.cardPad} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className={T.title}>Coach</h2>
        <div className="flex items-center gap-2">
          {ai.state === 'loading' && <span className={T.muted}>asking AI...</span>}
          <span className={T.label}>{originLabel}</span>
        </div>
      </div>

      {coach.unlock ? (
        <div className="space-y-3">
          <p className={T.body}>
            {coach.unlock.drillsNeeded === 1
              ? 'Do 1 more drill to unlock this'
              : `Do ${coach.unlock.drillsNeeded} more drills to unlock this`}
          </p>
          <button
            type="button"
            className={T.secondary}
            onClick={() => onAction(coach.unlock!.action)}
          >
            {coach.unlock.action.label}
          </button>
        </div>
      ) : coach.emptyScope ? (
        <div className="space-y-3">
          <p className={T.body}>{coach.emptyScope.message}</p>
          <button
            type="button"
            className={T.secondary}
            onClick={() => onAction(coach.emptyScope!.action)}
          >
            {coach.emptyScope.action.label}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const rawLines = showAiLines ? ai.lines! : coach.lines;
            const lines = rawLines.slice(0, 3);

            if (lines.length === 0) {
              return <p className={T.muted}>No coach insights available.</p>;
            }

            return lines.map((line) => (
              <div
                key={line.insightId}
                className="space-y-1.5 border-t border-[#27272A] pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={T.label}>{line.title}</span>
                    {line.thin && <span className={T.tag}>thin data</span>}
                  </div>
                  <span className={`font-mono text-xs text-zinc-400`}>
                    N = {line.sampleSize}
                  </span>
                </div>

                <p className={T.body}>{line.sentence}</p>

                {line.action && (
                  <div className="pt-1">
                    <button
                      type="button"
                      className={T.secondary}
                      onClick={() => onAction(line.action!)}
                    >
                      {line.action.label}
                    </button>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
