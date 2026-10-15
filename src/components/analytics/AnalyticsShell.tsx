import { ANALYTICS_TABS, type AnalyticsShellProps } from '../../types/analytics';
import { FilterBar } from './FilterBar';

/** Header, tab bar and filter bar around whichever analytics screen is open. */
export function AnalyticsShell({ tab, onTab, filter, onFilter, onBack, children }: AnalyticsShellProps) {
  return (
    <div className="space-y-4 text-[#FAFAFA]">
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Back
          </button>
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">Analytics</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Computed on this computer from your finished sessions. Counts and timing, not reasons.</p>
          </div>
        </div>
        <nav aria-label="Analytics sections" className="flex flex-wrap gap-2">
          {ANALYTICS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={t.id === tab ? 'page' : undefined}
              onClick={() => onTab(t.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                t.id === tab ? 'border-zinc-300 bg-zinc-100 text-zinc-900' : 'border-[#27272A] text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <FilterBar filter={filter} onChange={onFilter} />
      </section>
      {children}
    </div>
  );
}
