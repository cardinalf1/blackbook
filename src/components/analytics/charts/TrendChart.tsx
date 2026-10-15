// A line chart of rates (0 to 1) over time with one line per series. Series are told apart by
// marker shape and dash pattern as well as brightness, and every series is named in a legend with
// its latest value, so nothing relies on color alone. Points from few answers are drawn hollow.

import { LOW_CONFIDENCE_ATTEMPTS } from '../../../config/analyticsConfig';

export interface TrendPoint {
  /** Epoch ms. */
  x: number;
  /** 0 to 1. */
  y: number;
  /** Answers behind the point; fewer than LOW_CONFIDENCE_ATTEMPTS draws it hollow. */
  n: number;
}

export interface TrendSeries {
  id: string;
  label: string;
  points: readonly TrendPoint[];
}

export interface TrendChartProps {
  series: readonly TrendSeries[];
  /** Spoken description of the whole chart. */
  label: string;
  width?: number;
  height?: number;
}

const STYLES = [
  { stroke: '#fafafa', dash: undefined, shape: 'circle' as const },
  { stroke: '#a1a1aa', dash: '5 3', shape: 'square' as const },
];

const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function TrendChart({ series, label, width = 560, height = 180 }: TrendChartProps) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p className="text-xs text-zinc-500">No answers in this view yet.</p>;
  const left = 34;
  const right = 10;
  const top = 8;
  const bottom = 22;
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const x = (v: number) => (maxX === minX ? (left + width - right) / 2 : left + ((v - minX) * (width - left - right)) / (maxX - minX));
  const y = (v: number) => top + (1 - Math.max(0, Math.min(1, v))) * (height - top - bottom);
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl" role="img" aria-label={label}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={left} x2={width - right} y1={y(g)} y2={y(g)} stroke="#27272A" strokeWidth={1} />
            <text x={left - 6} y={y(g) + 3} textAnchor="end" className="fill-zinc-500 font-mono text-[10px]">{`${g * 100}%`}</text>
          </g>
        ))}
        <text x={left} y={height - 6} className="fill-zinc-500 font-mono text-[10px]">{dateText(minX)}</text>
        {maxX !== minX && (
          <text x={width - right} y={height - 6} textAnchor="end" className="fill-zinc-500 font-mono text-[10px]">{dateText(maxX)}</text>
        )}
        {series.map((s, si) => {
          const st = STYLES[si % STYLES.length] as (typeof STYLES)[number];
          return (
            <g key={s.id}>
              {s.points.length > 1 && (
                <polyline fill="none" stroke={st.stroke} strokeWidth={1.5} strokeDasharray={st.dash} points={s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} />
              )}
              {s.points.map((p, i) => {
                const common = { stroke: st.stroke, strokeWidth: 1.5, fill: p.n < LOW_CONFIDENCE_ATTEMPTS ? '#0A0A0C' : st.stroke };
                return st.shape === 'circle' ? (
                  <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3} {...common} />
                ) : (
                  <rect key={i} x={x(p.x) - 3} y={y(p.y) - 3} width={6} height={6} {...common} />
                );
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-zinc-400">
        {series.map((s, si) => {
          const last = s.points[s.points.length - 1];
          const mark = (STYLES[si % STYLES.length] as (typeof STYLES)[number]).shape === 'circle' ? '● ' : '■ ';
          return (
            <span key={s.id}>
              {mark}
              {s.label}
              {last ? `: latest ${Math.round(last.y * 100)}% (${last.n} ${last.n === 1 ? 'answer' : 'answers'})` : ': no data'}
            </span>
          );
        })}
        <span className="text-zinc-500">hollow marker = fewer than {LOW_CONFIDENCE_ATTEMPTS} answers</span>
      </figcaption>
    </figure>
  );
}
