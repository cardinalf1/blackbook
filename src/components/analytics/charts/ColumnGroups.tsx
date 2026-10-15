// Grouped columns chart: groups on x, series per group, values written on top.
// Hand-written SVG, dark monochrome, readable at a glance, never relying on color alone.

export interface ColumnSeries {
  id: string;
  label: string;
  pattern?: 'solid' | 'striped' | 'dots';
}

export interface ColumnDatum {
  seriesId: string;
  value: number;
  valueText?: string;
}

export interface ColumnGroup {
  id: string;
  label: string;
  data: readonly ColumnDatum[];
}

export interface ColumnGroupsProps {
  groups: readonly ColumnGroup[];
  series: readonly ColumnSeries[];
  label: string;
  width?: number;
  height?: number;
  formatValue?: (val: number) => string;
}

const SERIES_PATTERNS = [
  { id: 'solid', label: 'solid' },
  { id: 'striped', label: 'striped' },
  { id: 'dots', label: 'dots' },
] as const;

export function ColumnGroups({
  groups,
  series,
  label,
  width = 540,
  height = 200,
  formatValue,
}: ColumnGroupsProps) {
  if (groups.length === 0 || series.length === 0) {
    return <p className="text-xs text-zinc-500">No timing data in this view yet.</p>;
  }

  const left = 40;
  const right = 16;
  const top = 30;
  const bottom = 44;

  const allValues = groups.flatMap((g) => g.data.map((d) => d.value));
  const rawMax = Math.max(0, ...allValues);
  const maxVal = rawMax > 0 ? rawMax : 1;

  const y = (v: number) =>
    top + (1 - Math.max(0, Math.min(1, v / maxVal))) * (height - top - bottom);

  const chartAreaWidth = width - left - right;
  const groupSlot = chartAreaWidth / groups.length;
  const colWidth = Math.max(12, Math.min(28, (groupSlot * 0.7) / series.length));
  const colGap = 4;
  const totalGroupColsWidth = series.length * colWidth + (series.length - 1) * colGap;

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-2xl overflow-visible"
        role="img"
        aria-label={label}
      >
        <defs>
          <pattern
            id="col-pat-striped"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="#fafafa" strokeWidth="2" />
          </pattern>
          <pattern id="col-pat-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.2" fill="#fafafa" />
          </pattern>
        </defs>

        {/* Baseline axis */}
        <line
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
          stroke="#3F3F46"
          strokeWidth={1}
        />

        {/* Grid lines (0, 50%, 100%) */}
        {[0, 0.5, 1].map((ratio) => {
          const val = ratio * maxVal;
          const yPos = y(val);
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={yPos} y2={yPos} stroke="#27272A" strokeWidth={1} />
              {val > 0 && (
                <text
                  x={left - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[10px]"
                >
                  {formatValue ? formatValue(val) : Math.round(val)}
                </text>
              )}
            </g>
          );
        })}

        {/* Groups and series bars */}
        {groups.map((group, gi) => {
          const groupCenter = left + (gi + 0.5) * groupSlot;
          const startX = groupCenter - totalGroupColsWidth / 2;

          return (
            <g key={group.id}>
              {series.map((s, si) => {
                const datum = group.data.find((d) => d.seriesId === s.id);
                const val = datum?.value ?? 0;
                const colX = startX + si * (colWidth + colGap);
                const colY = y(val);
                const colH = Math.max(0, height - bottom - colY);

                const patKey = s.pattern ?? (si === 0 ? 'solid' : si === 1 ? 'striped' : 'dots');
                const fillStyle =
                  patKey === 'striped'
                    ? 'url(#col-pat-striped)'
                    : patKey === 'dots'
                      ? 'url(#col-pat-dots)'
                      : '#a1a1aa';

                const valText = datum?.valueText ?? (formatValue ? formatValue(val) : String(Math.round(val)));

                return (
                  <g key={s.id}>
                    {/* Background bar track if height > 0 */}
                    <rect
                      x={colX}
                      y={top}
                      width={colWidth}
                      height={height - top - bottom}
                      fill="#18181b"
                      opacity={0.4}
                      rx={2}
                    />
                    {colH > 0 && (
                      <rect
                        x={colX}
                        y={colY}
                        width={colWidth}
                        height={colH}
                        fill={fillStyle}
                        stroke="#71717A"
                        strokeWidth={1}
                        rx={2}
                      />
                    )}
                    {/* Value written on top of column */}
                    <text
                      x={colX + colWidth / 2}
                      y={Math.max(14, colY - 4)}
                      textAnchor="middle"
                      className="fill-zinc-300 font-mono text-[10px]"
                    >
                      {valText}
                    </text>
                  </g>
                );
              })}

              {/* Group label under X axis */}
              <text
                x={groupCenter}
                y={height - bottom + 18}
                textAnchor="middle"
                className="fill-zinc-300 font-mono text-xs"
              >
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Series legend with patterns and labels */}
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-zinc-400 pt-1">
        {series.map((s, si) => {
          const patKey = s.pattern ?? (si === 0 ? 'solid' : si === 1 ? 'striped' : 'dots');
          const swatchFill =
            patKey === 'striped'
              ? 'url(#col-pat-striped)'
              : patKey === 'dots'
                ? 'url(#col-pat-dots)'
                : '#a1a1aa';
          return (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" className="rounded border border-zinc-700 bg-zinc-900 shrink-0">
                <rect width="14" height="14" fill={swatchFill} stroke="#71717a" strokeWidth="0.5" />
              </svg>
              <span>{s.label}</span>
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
