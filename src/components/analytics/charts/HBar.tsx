// Labelled horizontal bars with value text.
// Dark monochrome theme, readable at a glance, every value also written as text.

export interface HBarItem {
  id: string;
  label: string;
  value: number;
  valueText?: string;
  subtext?: string;
  pattern?: 'solid' | 'striped' | 'dots';
}

export interface HBarProps {
  items: readonly HBarItem[];
  label: string;
  max?: number;
  className?: string;
}

const PATTERN_STYLES = {
  solid: { fill: '#e4e4e7', stroke: '#a1a1aa' },
  striped: { fill: 'url(#hbar-pat-stripes)', stroke: '#a1a1aa' },
  dots: { fill: 'url(#hbar-pat-dots)', stroke: '#a1a1aa' },
};

export function HBar({ items, label, max, className = '' }: HBarProps) {
  if (items.length === 0) {
    return <p className="text-xs text-zinc-500">No data available.</p>;
  }

  const rawMax = Math.max(...items.map((i) => i.value), 0);
  const maxVal = max ?? (rawMax > 0 ? rawMax : 1);

  return (
    <figure className={`space-y-3 font-mono ${className}`} role="region" aria-label={label}>
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <pattern id="hbar-pat-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#fafafa" strokeWidth="2" />
          </pattern>
          <pattern id="hbar-pat-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.2" fill="#fafafa" />
          </pattern>
        </defs>
      </svg>

      {items.map((item, idx) => {
        const pct = maxVal > 0 ? Math.min(100, Math.max(0, (item.value / maxVal) * 100)) : 0;
        const valueDisplay = item.valueText ?? String(item.value);
        const patternKey = item.pattern ?? (idx % 2 === 0 ? 'solid' : 'striped');

        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-zinc-200 font-medium">{item.label}</span>
              <span className="text-zinc-300 font-mono font-medium">{valueDisplay}</span>
            </div>

            <div
              className="h-3.5 w-full rounded bg-[#27272A] p-0.5"
              role="progressbar"
              aria-label={`${item.label}: ${valueDisplay}`}
              aria-valuenow={item.value}
              aria-valuemin={0}
              aria-valuemax={maxVal}
            >
              <svg width="100%" height="100%" className="block rounded-sm overflow-hidden">
                <rect
                  x="0"
                  y="0"
                  width={`${pct}%`}
                  height="100%"
                  fill={PATTERN_STYLES[patternKey].fill}
                  stroke={PATTERN_STYLES[patternKey].stroke}
                  strokeWidth="0.5"
                  rx="1"
                />
              </svg>
            </div>

            {item.subtext && <div className="text-[11px] text-zinc-500">{item.subtext}</div>}
          </div>
        );
      })}
    </figure>
  );
}
