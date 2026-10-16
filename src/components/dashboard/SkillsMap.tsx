import clsx from 'clsx';
import type { DashboardData, SkillsMapProps } from '../../types/dashboard';
import { COLOR, T } from '../ui/tokens';

export function SkillsMap({ skills, onSkill, onAction }: SkillsMapProps) {
  return (
    <section className={clsx(T.card, T.cardPad, 'space-y-6')} aria-label="Skills map">
      <div className="flex items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
        <h2 className={T.title}>Skills</h2>
      </div>

      {skills.domains.length === 0 ? (
        <p className={T.muted}>No skill data in this period.</p>
      ) : (
        <div className="space-y-6">
          {skills.domains.map((domain) => {
            const officialWeightText =
              domain.officialWeight !== null
                ? `Official weight ${Math.round(domain.officialWeight * 100)}%`
                : 'Official weight unknown';
            const practiceShareText =
              domain.practiceShare !== null
                ? `Your practice time ${Math.round(domain.practiceShare * 100)}%`
                : 'Your practice time unknown';

            return (
              <div key={domain.domainCode} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#27272A] pb-1.5">
                  <span className={clsx(T.title, 'text-zinc-200')}>{domain.domain}</span>
                  <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
                    <span>{officialWeightText}</span>
                    <span>{practiceShareText}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {domain.skills.map((skill) => {
                    const hasAttempts = skill.attempts > 0;
                    const accuracy = hasAttempts ? skill.correct / skill.attempts : 0;
                    const barWidth = Math.max(0, Math.min(1000, accuracy * 1000));
                    const xLow = Math.max(0, Math.min(1000, skill.low * 1000));
                    const xHigh = Math.max(0, Math.min(1000, skill.high * 1000));

                    return (
                      <div key={skill.skillCode} className="space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSkill(skill.skillCode)}
                            className={clsx(T.link, 'text-left font-mono text-xs text-white')}
                          >
                            {skill.skill}
                          </button>
                          <div className="font-mono text-xs tabular-nums">
                            {hasAttempts ? (
                              <span className="text-zinc-400">
                                {skill.correct} of {skill.attempts} &middot; N = {skill.attempts}
                              </span>
                            ) : (
                              <span className="italic text-zinc-500">not tried yet</span>
                            )}
                          </div>
                        </div>

                        <div className="w-full">
                          <svg
                            viewBox="0 0 1000 16"
                            className="block h-3.5 w-full overflow-visible"
                            role="img"
                            aria-label={`${skill.skill}: ${hasAttempts ? `${Math.round(accuracy * 100)}% accuracy` : 'not tried yet'}`}
                          >
                            {/* 0-100% outlined track */}
                            <rect
                              x="0"
                              y="3"
                              width="1000"
                              height="10"
                              fill={COLOR.canvas}
                              stroke={COLOR.border}
                              strokeWidth="1"
                              rx="1"
                            />

                            {hasAttempts && (
                              <>
                                {/* Filled white bar to accuracy */}
                                <rect
                                  x="0"
                                  y="3"
                                  width={barWidth}
                                  height="10"
                                  fill={COLOR.text}
                                  rx="1"
                                />

                                {/* Wilson interval line with end ticks */}
                                <g
                                  data-testid="wilson-interval"
                                  aria-label={`Wilson interval ${Math.round(skill.low * 100)}%–${Math.round(skill.high * 100)}%`}
                                >
                                  <line
                                    x1={xLow}
                                    y1="8"
                                    x2={xHigh}
                                    y2="8"
                                    stroke={COLOR.borderStrong}
                                    strokeWidth="2"
                                  />
                                  {/* End tick low */}
                                  <line
                                    x1={xLow}
                                    y1="1"
                                    x2={xLow}
                                    y2="15"
                                    stroke={COLOR.text}
                                    strokeWidth="2"
                                  />
                                  <line
                                    x1={xLow}
                                    y1="1"
                                    x2={xLow}
                                    y2="15"
                                    stroke={COLOR.black}
                                    strokeWidth="1"
                                  />
                                  {/* End tick high */}
                                  <line
                                    x1={xHigh}
                                    y1="1"
                                    x2={xHigh}
                                    y2="15"
                                    stroke={COLOR.text}
                                    strokeWidth="2"
                                  />
                                  <line
                                    x1={xHigh}
                                    y1="1"
                                    x2={xHigh}
                                    y2="15"
                                    stroke={COLOR.black}
                                    strokeWidth="1"
                                  />
                                  <title>{`Wilson interval: ${Math.round(skill.low * 100)}%–${Math.round(skill.high * 100)}%`}</title>
                                </g>
                              </>
                            )}
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {skills.methodNote && (
        <p className={clsx(T.muted, 'border-t border-[#27272A] pt-4 font-mono')}>{skills.methodNote}</p>
      )}

      {skills.topDrills.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pt-1">
          {skills.topDrills.map((drill) => {
            const sectionName = drill.section === 'rw' ? 'Reading and Writing' : 'Math';
            const label = `Drill top ${drill.skillCodes.length} ${sectionName} skills`;
            return (
              <button
                key={`${drill.section}-${drill.skillCodes.join('-')}`}
                type="button"
                onClick={() => onAction({ kind: 'drill', label, config: drill.config })}
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
