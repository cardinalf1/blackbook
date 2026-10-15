// Range bars chart: vertical range bars from low to high on a shared axis, one per test,
// with a small mid tick, a text label under each, per-item group id drawn with a different
// pattern/marker AND named in a legend, and optional note strings.
// Every value is also written as text, never relying on color alone.

export interface RangeBarItem {
  id: string;
  label: string;
  low: number;
  high: number;
  mid?: number;
  groupId: string;
  groupLabel?: string;
  notes?: readonly string[];
  valueLabel?: string;
}

export interface RangeBarsProps {
  items: readonly RangeBarItem[];
  label: string;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  height?: number;
  orientation?: 'vertical' | 'horizontal';
}

const PATTERNS = [
  { id: 'hatch', label: 'diagonal hatch' },
  { id: 'dots', label: 'dotted' },
  { id: 'cross', label: 'crosshatch' },
  { id: 'solid', label: 'solid' },
] as const;

export function RangeBars({
  items,
  label,
  min,
  max,
  step,
  width = 560,
  height = 240,
}: RangeBarsProps) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">No test data in this view yet.</p>;
  }

  const left = 44;
  const right = 16;
  const top = 26;
  const bottom = 78;

  const rawMin = Math.min(...items.map((i) => i.low));
  const rawMax = Math.max(...items.map((i) => i.high));
  const minVal = min ?? Math.floor(rawMin / 50) * 50;
  const maxVal = max ?? Math.ceil(rawMax / 50) * 50;
  const span = maxVal === minVal ? 1 : maxVal - minVal;

  const y = (v: number) =>
    top + (1 - Math.max(0, Math.min(1, (v - minVal) / span))) * (height - top - bottom);

  // Axis grid ticks
  const tickStep = step ?? (span > 500 ? 200 : span > 200 ? 100 : 50);
  const gridTicks: number[] = [];
  const startTick = Math.ceil(minVal / tickStep) * tickStep;
  for (let t = startTick; t <= maxVal; t += tickStep) {
    gridTicks.push(t);
  }
  if (!gridTicks.includes(minVal)) gridTicks.unshift(minVal);
  if (!gridTicks.includes(maxVal)) gridTicks.push(maxVal);

  // Group patterns mapping
  const groups: { id: string; label: string; patternIdx: number }[] = [];
  items.forEach((item) => {
    if (!groups.some((g) => g.id === item.groupId)) {
      groups.push({
        id: item.groupId,
        label: item.groupLabel ?? item.groupId,
        patternIdx: groups.length % PATTERNS.length,
      });
    }
  });

  const getGroupPattern = (groupId: string) => {
    const g = groups.find((grp) => grp.id === groupId);
    const idx = g ? g.patternIdx : 0;
    return PATTERNS[idx] ?? PATTERNS[0];
  };

  const chartAreaWidth = width - left - right;
  const slotWidth = chartAreaWidth / items.length;
  const barWidth = Math.max(14, Math.min(32, slotWidth * 0.45));

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-2xl overflow-visible"
        role="img"
        aria-label={label}
      >
        <defs>
          <pattern id="rb-pat-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#a1a1aa" strokeWidth="2.5" />
          </pattern>
          <pattern id="rb-pat-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.5" fill="#fafafa" />
          </pattern>
          <pattern id="rb-pat-cross" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="#71717a" strokeWidth="1.5" />
            <line x1="8" y1="0" x2="0" y2="8" stroke="#71717a" strokeWidth="1.5" />
          </pattern>
          <pattern id="rb-pat-solid" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#52525b" />
          </pattern>
        </defs>

        {/* Grid lines and tick values */}
        {gridTicks.map((g) => (
          <g key={g}>
            <line x1={left} x2={width - right} y1={y(g)} y2={y(g)} stroke="#27272A" strokeWidth={1} />
            <text
              x={left - 6}
              y={y(g) + 3}
              textAnchor="end"
              className="fill-zinc-500 font-mono text-[10px]"
            >
              {g}
            </text>
          </g>
        ))}

        {/* Test range bars */}
        {items.map((item, i) => {
          const cx = left + (i + 0.5) * slotWidth;
          const yHigh = y(item.high);
          const yLow = y(item.low);
          const barH = Math.max(3, yLow - yHigh);
          const pat = getGroupPattern(item.groupId);
          const midVal = item.mid ?? Math.round((item.low + item.high) / 2);
          const yMid = y(midVal);
          const rangeText = item.valueLabel ?? `${item.low} to ${item.high}`;

          return (
            <g key={item.id}>
              {/* Range bar background and patterned fill */}
              <rect
                x={cx - barWidth / 2}
                y={yHigh}
                width={barWidth}
                height={barH}
                fill="#18181b"
                stroke="#3f3f46"
                strokeWidth={1}
                rx={2}
              />
              <rect
                x={cx - barWidth / 2}
                y={yHigh}
                width={barWidth}
                height={barH}
                fill={`url(#rb-pat-${pat.id})`}
                stroke="#71717a"
                strokeWidth={1}
                rx={2}
              />

              {/* Range caps (top and bottom horizontal lines) */}
              <line
                x1={cx - barWidth / 2 - 2}
                x2={cx + barWidth / 2 + 2}
                y1={yHigh}
                y2={yHigh}
                stroke="#fafafa"
                strokeWidth={1.5}
              />
              <line
                x1={cx - barWidth / 2 - 2}
                x2={cx + barWidth / 2 + 2}
                y1={yLow}
                y2={yLow}
                stroke="#fafafa"
                strokeWidth={1.5}
              />

              {/* Small mid tick line */}
              <line
                x1={cx - barWidth / 2 - 4}
                x2={cx + barWidth / 2 + 4}
                y1={yMid}
                y2={yMid}
                stroke="#fafafa"
                strokeWidth={2}
              />
              {/* Mid tick marker dot */}
              <circle cx={cx} cy={yMid} r={2.5} fill="#fafafa" />

              {/* Value text above bar */}
              <text
                x={cx}
                y={yHigh - 6}
                textAnchor="middle"
                className="fill-zinc-300 font-mono text-[10px]"
              >
                {rangeText}
              </text>

              {/* Labels under the bar */}
              <text
                x={cx}
                y={height - bottom + 16}
                textAnchor="middle"
                className="fill-zinc-200 font-mono text-[11px]"
              >
                {item.label}
              </text>
              <text
                x={cx}
                y={height - bottom + 30}
                textAnchor="middle"
                className="fill-zinc-400 font-mono text-[10px]"
              >
                {rangeText}
              </text>
              {item.notes && item.notes.length > 0 && (
                <text
                  x={cx}
                  y={height - bottom + 44}
                  textAnchor="middle"
                  className="fill-amber-300 font-mono text-[10px]"
                >
                  {item.notes.join(' · ')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend with group pattern and explanation */}
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-zinc-400 pt-1">
        {groups.map((g) => {
          const pat = PATTERNS[g.patternIdx] ?? PATTERNS[0];
          return (
            <span key={g.id} className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" className="rounded border border-zinc-700 bg-zinc-900 shrink-0">
                <rect width="14" height="14" fill={`url(#rb-pat-${pat.id})`} />
              </svg>
              <span>{g.label}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <span className="font-bold text-zinc-300">—</span> mid tick = estimate midpoint
        </span>
      </figcaption>
    </figure>
  );
}
