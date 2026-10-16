import type { SessionMode } from '../../types/session';
import type { Section } from '../../types/sat';
import type { TrendsProps } from '../../types/dashboard';
import { SERIES_DASH, SERIES_MARKER, T } from '../ui/tokens';

function formatPace(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function parseDayMs(day: string): number {
  const t = Date.parse(day.includes('T') ? day : `${day}T00:00:00`);
  return Number.isNaN(t) ? 0 : t;
}

function renderMarker(
  shape: 'circle' | 'square' | 'triangle' | 'diamond',
  cx: number,
  cy: number,
  isHollow: boolean,
  key: string | number,
) {
  const fill = isHollow ? '#000000' : '#FFFFFF';
  const stroke = '#FFFFFF';
  const strokeWidth = 1.5;

  switch (shape) {
    case 'square':
      return (
        <rect
          key={key}
          x={cx - 3.5}
          y={cy - 3.5}
          width={7}
          height={7}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'triangle':
      return (
        <polygon
          key={key}
          points={`${cx},${cy - 4} ${cx - 4},${cy + 3.5} ${cx + 4},${cy + 3.5}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'diamond':
      return (
        <polygon
          key={key}
          points={`${cx},${cy - 4.5} ${cx + 4.5},${cy} ${cx},${cy + 4.5} ${cx - 4.5},${cy}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'circle':
    default:
      return (
        <circle
          key={key}
          cx={cx}
          cy={cy}
          r={3.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
  }
}

interface AccuracyPoint {
  day: string;
  attempts: number;
  correct: number;
  rate: number;
}

interface PacePoint {
  day: string;
  attempts: number;
  timeMs: number;
  paceMs: number;
}

const ACCURACY_MODES: readonly { mode: SessionMode; label: string }[] = [
  { mode: 'drill', label: 'Drills' },
  { mode: 'exam', label: 'Exam modules' },
];

const PACE_SECTIONS: readonly { section: Section; label: string }[] = [
  { section: 'rw', label: 'Reading and Writing' },
  { section: 'math', label: 'Math' },
];

export function TrendsCard({ trends }: TrendsProps) {
  const hasAnyAccuracy = trends.accuracy.some((a) => a.attempts > 0);
  const hasAnyPace = trends.pace.some((p) => p.attempts > 0);

  if (!hasAnyAccuracy && !hasAnyPace) {
    return (
      <div className={`${T.card} ${T.cardPad} space-y-4`}>
        <h2 className={T.title}>Trends</h2>
        <p className={T.muted}>No answers in this period yet.</p>
      </div>
    );
  }

  // --- Accuracy data processing ---
  const accuracySeries = ACCURACY_MODES.map((m) => {
    const points: AccuracyPoint[] = trends.accuracy
      .filter((row) => row.mode === m.mode && row.attempts > 0)
      .map((row) => ({
        day: row.day,
        attempts: row.attempts,
        correct: row.correct,
        rate: row.correct / row.attempts,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return {
      mode: m.mode,
      label: m.label,
      points,
      isTable: points.length < trends.tableBelowPoints,
    };
  });

  const accuracyChartSeries = accuracySeries.filter((s) => !s.isTable && s.points.length > 0);
  const accuracyTableSeries = accuracySeries.filter((s) => s.isTable && s.points.length > 0);

  // --- Pace data processing ---
  const paceSeries = PACE_SECTIONS.map((s) => {
    const map = new Map<string, { attempts: number; timeMs: number }>();
    for (const row of trends.pace) {
      if (row.section === s.section && row.attempts > 0) {
        const existing = map.get(row.day) ?? { attempts: 0, timeMs: 0 };
        existing.attempts += row.attempts;
        existing.timeMs += row.timeMs;
        map.set(row.day, existing);
      }
    }

    const points: PacePoint[] = [];
    for (const [day, data] of map.entries()) {
      if (data.attempts > 0) {
        points.push({
          day,
          attempts: data.attempts,
          timeMs: data.timeMs,
          paceMs: data.timeMs / data.attempts,
        });
      }
    }
    points.sort((a, b) => a.day.localeCompare(b.day));

    return {
      section: s.section,
      label: s.label,
      points,
      isTable: points.length < trends.tableBelowPoints,
    };
  });

  const paceChartSeries = paceSeries.filter((s) => !s.isTable && s.points.length > 0);
  const paceTableSeries = paceSeries.filter((s) => s.isTable && s.points.length > 0);

  // Common SVG layout parameters
  const chartWidth = 640;
  const chartHeight = 220;
  const left = 44;
  const right = 160;
  const top = 20;
  const bottom = 30;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;

  return (
    <div className={`${T.card} ${T.cardPad} space-y-8`}>
      <h2 className={T.title}>Trends</h2>

      {/* Chart 1: Accuracy over time */}
      <div className="space-y-4">
        <div>
          <span className={T.label}>Accuracy over time</span>
        </div>

        {!hasAnyAccuracy ? (
          <p className={T.muted}>No answers in this period yet.</p>
        ) : (
          <>
            {accuracyChartSeries.length > 0 && (() => {
              const allPoints = accuracyChartSeries.flatMap((s) => s.points);
              const days = Array.from(new Set(allPoints.map((p) => p.day))).sort();
              const minDay = days[0] ?? '';
              const maxDay = days[days.length - 1] ?? '';
              const minDayMs = parseDayMs(minDay);
              const maxDayMs = parseDayMs(maxDay);

              const getX = (day: string) => {
                if (minDayMs === maxDayMs) return left + plotWidth / 2;
                const ms = parseDayMs(day);
                return left + ((ms - minDayMs) / (maxDayMs - minDayMs)) * plotWidth;
              };

              const getY = (rate: number) =>
                top + (1 - Math.max(0, Math.min(1, rate))) * plotHeight;

              return (
                <div className="space-y-2">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full"
                    role="img"
                    aria-label="Accuracy over time chart"
                  >
                    {/* Y-axis grid lines and labels */}
                    {[0, 0.5, 1].map((g) => (
                      <g key={g}>
                        <line
                          x1={left}
                          x2={chartWidth - right}
                          y1={getY(g)}
                          y2={getY(g)}
                          stroke="#27272A"
                          strokeWidth={1}
                        />
                        <text
                          x={left - 6}
                          y={getY(g) + 3}
                          textAnchor="end"
                          className="fill-zinc-400 font-mono text-[10px]"
                        >
                          {`${Math.round(g * 100)}%`}
                        </text>
                      </g>
                    ))}

                    {/* X-axis date labels */}
                    <text
                      x={left}
                      y={chartHeight - 8}
                      className="fill-zinc-400 font-mono text-[10px]"
                    >
                      {minDay}
                    </text>
                    {minDay !== maxDay && (
                      <text
                        x={chartWidth - right}
                        y={chartHeight - 8}
                        textAnchor="end"
                        className="fill-zinc-400 font-mono text-[10px]"
                      >
                        {maxDay}
                      </text>
                    )}

                    {/* Series lines and markers */}
                    {accuracyChartSeries.map((s, idx) => {
                      const dash = SERIES_DASH[idx % SERIES_DASH.length];
                      const shape = SERIES_MARKER[idx % SERIES_MARKER.length] ?? 'circle';
                      const pathD = s.points
                        .map(
                          (p, i) =>
                            `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.rate)}`,
                        )
                        .join(' ');
                      const last = s.points[s.points.length - 1];
                      const lastX = last ? getX(last.day) : 0;
                      const lastY = last ? getY(last.rate) : 0;

                      return (
                        <g key={s.mode}>
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                            strokeDasharray={dash || undefined}
                          />

                          {s.points.map((p) => {
                            const cx = getX(p.day);
                            const cy = getY(p.rate);
                            const isHollow = p.attempts < trends.hollowBelow;
                            return renderMarker(shape, cx, cy, isHollow, p.day);
                          })}

                          {last && (
                            <text
                              x={lastX + 8}
                              y={lastY + 3}
                              className="fill-white font-mono text-[10px]"
                            >
                              {s.label} ({Math.round(last.rate * 100)}%, N={last.attempts})
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <p className={T.muted}>
                    hollow marker = fewer than {trends.hollowBelow} answers
                  </p>
                </div>
              );
            })()}

            {accuracyTableSeries.length > 0 && (
              <div className="space-y-4">
                {accuracyTableSeries.map((s) => (
                  <div key={s.mode} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={T.label}>{s.label}</span>
                      <span className="font-mono text-xs text-zinc-400">
                        N = {s.points.reduce((sum, p) => sum + p.attempts, 0)}
                      </span>
                    </div>
                    <table className="w-full border border-[#27272A] font-mono text-xs text-zinc-300">
                      <thead>
                        <tr className="border-b border-[#27272A] bg-zinc-900/50 text-zinc-400">
                          <th className="px-2 py-1 text-left">Day</th>
                          <th className="px-2 py-1 text-right">Answers</th>
                          <th className="px-2 py-1 text-right">Right</th>
                          <th className="px-2 py-1 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.points.map((p) => (
                          <tr
                            key={p.day}
                            className="border-b border-[#27272A] last:border-b-0"
                          >
                            <td className="px-2 py-1 text-left">{p.day}</td>
                            <td className="px-2 py-1 text-right">{p.attempts}</td>
                            <td className="px-2 py-1 text-right">{p.correct}</td>
                            <td className="px-2 py-1 text-right">
                              {Math.round(p.rate * 100)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chart 2: Pace vs target over time */}
      <div className="space-y-4">
        <div>
          <span className={T.label}>Pace vs target over time</span>
        </div>

        {!hasAnyPace ? (
          <p className={T.muted}>No answers in this period yet.</p>
        ) : (
          <>
            {paceChartSeries.length > 0 && (() => {
              const allPoints = paceChartSeries.flatMap((s) => s.points);
              const days = Array.from(new Set(allPoints.map((p) => p.day))).sort();
              const minDay = days[0] ?? '';
              const maxDay = days[days.length - 1] ?? '';
              const minDayMs = parseDayMs(minDay);
              const maxDayMs = parseDayMs(maxDay);

              const getX = (day: string) => {
                if (minDayMs === maxDayMs) return left + plotWidth / 2;
                const ms = parseDayMs(day);
                return left + ((ms - minDayMs) / (maxDayMs - minDayMs)) * plotWidth;
              };

              const allValues = [
                ...allPoints.map((p) => p.paceMs),
                ...paceChartSeries.map((s) => trends.targetMs[s.section]),
              ];
              const rawMinPace = Math.min(...allValues);
              const rawMaxPace = Math.max(...allValues);
              const diffPace = rawMaxPace === rawMinPace ? 20000 : rawMaxPace - rawMinPace;
              const yMin = Math.max(0, rawMinPace - diffPace * 0.1);
              const yMax = rawMaxPace + diffPace * 0.1;

              const getY = (ms: number) =>
                top + (1 - (ms - yMin) / (yMax - yMin)) * plotHeight;

              return (
                <div className="space-y-2">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full"
                    role="img"
                    aria-label="Pace vs target over time chart"
                  >
                    {/* Y-axis grid lines and labels in monospace */}
                    {[yMin, (yMin + yMax) / 2, yMax].map((val, idx) => (
                      <g key={idx}>
                        <line
                          x1={left}
                          x2={chartWidth - right}
                          y1={getY(val)}
                          y2={getY(val)}
                          stroke="#27272A"
                          strokeWidth={1}
                        />
                        <text
                          x={left - 6}
                          y={getY(val) + 3}
                          textAnchor="end"
                          className="fill-zinc-400 font-mono text-[10px]"
                        >
                          {formatPace(val)}
                        </text>
                      </g>
                    ))}

                    {/* X-axis date labels */}
                    <text
                      x={left}
                      y={chartHeight - 8}
                      className="fill-zinc-400 font-mono text-[10px]"
                    >
                      {minDay}
                    </text>
                    {minDay !== maxDay && (
                      <text
                        x={chartWidth - right}
                        y={chartHeight - 8}
                        textAnchor="end"
                        className="fill-zinc-400 font-mono text-[10px]"
                      >
                        {maxDay}
                      </text>
                    )}

                    {/* Horizontal dashed target lines */}
                    {paceChartSeries.map((s) => {
                      const targetVal = trends.targetMs[s.section];
                      const targetY = getY(targetVal);
                      return (
                        <g key={`target-${s.section}`}>
                          <line
                            x1={left}
                            x2={chartWidth - right}
                            y1={targetY}
                            y2={targetY}
                            stroke="#71717A"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                          />
                          <text
                            x={chartWidth - right + 8}
                            y={targetY + 3}
                            className="fill-zinc-400 font-mono text-[10px]"
                          >
                            {s.label} target ({formatPace(targetVal)})
                          </text>
                        </g>
                      );
                    })}

                    {/* Pace lines and markers */}
                    {paceChartSeries.map((s, idx) => {
                      const dash = SERIES_DASH[idx % SERIES_DASH.length];
                      const shape = SERIES_MARKER[idx % SERIES_MARKER.length] ?? 'circle';
                      const pathD = s.points
                        .map(
                          (p, i) =>
                            `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.paceMs)}`,
                        )
                        .join(' ');
                      const last = s.points[s.points.length - 1];
                      const lastX = last ? getX(last.day) : 0;
                      const lastY = last ? getY(last.paceMs) : 0;

                      return (
                        <g key={s.section}>
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                            strokeDasharray={dash || undefined}
                          />

                          {s.points.map((p) => {
                            const cx = getX(p.day);
                            const cy = getY(p.paceMs);
                            const isHollow = p.attempts < trends.hollowBelow;
                            return renderMarker(shape, cx, cy, isHollow, p.day);
                          })}

                          {last && (
                            <text
                              x={lastX + 8}
                              y={lastY + 3}
                              className="fill-white font-mono text-[10px]"
                            >
                              {s.label} ({formatPace(last.paceMs)}, N={last.attempts})
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <p className={T.muted}>
                    hollow marker = fewer than {trends.hollowBelow} answers
                  </p>
                </div>
              );
            })()}

            {paceTableSeries.length > 0 && (
              <div className="space-y-4">
                {paceTableSeries.map((s) => (
                  <div key={s.section} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={T.label}>{s.label}</span>
                      <span className="font-mono text-xs text-zinc-400">
                        target {formatPace(trends.targetMs[s.section])}
                      </span>
                    </div>
                    <table className="w-full border border-[#27272A] font-mono text-xs text-zinc-300">
                      <thead>
                        <tr className="border-b border-[#27272A] bg-zinc-900/50 text-zinc-400">
                          <th className="px-2 py-1 text-left">Day</th>
                          <th className="px-2 py-1 text-right">Answers</th>
                          <th className="px-2 py-1 text-right">Pace</th>
                          <th className="px-2 py-1 text-right">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.points.map((p) => (
                          <tr
                            key={p.day}
                            className="border-b border-[#27272A] last:border-b-0"
                          >
                            <td className="px-2 py-1 text-left">{p.day}</td>
                            <td className="px-2 py-1 text-right">{p.attempts}</td>
                            <td className="px-2 py-1 text-right">
                              {formatPace(p.paceMs)}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {formatPace(trends.targetMs[s.section])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
