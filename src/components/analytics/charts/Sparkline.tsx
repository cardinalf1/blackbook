// A tiny line of recent results, 0 to 1, oldest first. Monochrome; the last value is written out
// so nothing depends on seeing the line.

export interface SparklineProps {
  /** Values from 0 to 1, oldest first. */
  values: readonly number[];
  width?: number;
  height?: number;
  /** Spoken description, for example "Accuracy over the last 5 sessions". */
  label: string;
}

export function Sparkline({ values, width = 84, height = 22, label }: SparklineProps) {
  if (values.length === 0) return <span className="font-mono text-xs text-zinc-500">no trend</span>;
  const pad = 3;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v: number) => pad + (1 - Math.max(0, Math.min(1, v))) * (height - 2 * pad);
  const last = values[values.length - 1] as number;
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={width} height={height} role="img" aria-label={`${label}: ${values.map((v) => `${Math.round(v * 100)}%`).join(', ')}`} className="shrink-0">
        {values.length > 1 && <polyline fill="none" stroke="#a1a1aa" strokeWidth={1.5} points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 2.5 : 1.5} fill={i === values.length - 1 ? '#fafafa' : '#a1a1aa'} />
        ))}
      </svg>
      <span className="font-mono text-xs text-zinc-300">{`${Math.round(last * 100)}%`}</span>
    </span>
  );
}
