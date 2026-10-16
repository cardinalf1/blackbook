import clsx from 'clsx';
import type { TestsTableProps } from '../../types/dashboard';
import { T } from '../ui/tokens';

export function TestsTable({ tests, onOpenTest }: TestsTableProps) {
  return (
    <section className={clsx(T.card, T.cardPad, 'space-y-4')} aria-label="Tests table">
      <div className="flex items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
        <h2 className={T.title}>Tests</h2>
      </div>

      {tests.length === 0 ? (
        <p className={T.muted}>No finished tests in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#27272A] text-zinc-400">
                <th className="pb-2 pr-4 font-normal">Date</th>
                <th className="pb-2 pr-4 font-normal">Kind</th>
                <th className="pb-2 pr-4 font-normal">Estimate (approximation)</th>
                <th className="pb-2 pr-4 font-normal">Routing</th>
                <th className="pb-2 pr-4 font-normal">Paused</th>
                <th className="pb-2 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => {
                const dateStr = new Date(test.finishedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                const kindLabel =
                  test.kind === 'full'
                    ? 'Full test'
                    : test.kind === 'rw'
                      ? 'Reading and Writing'
                      : 'Math';

                let estimateRange = 'none';
                if (test.estimate) {
                  if (test.kind === 'full') {
                    if (test.estimate.total) {
                      estimateRange = `${test.estimate.total.low}–${test.estimate.total.high}`;
                    }
                  } else {
                    const sec = test.estimate.sections.find((s) => s.section === test.kind);
                    if (sec) {
                      estimateRange = `${sec.low}–${sec.high}`;
                    }
                  }
                }

                const routingStr =
                  test.routing.length > 0
                    ? test.routing
                        .map((r) => `${r.section === 'rw' ? 'R&W' : 'Math'}: ${r.route}`)
                        .join(', ')
                    : '—';

                const pausedStr = test.paused ? 'yes' : 'no';

                return (
                  <tr key={test.testId} className="border-b border-[#27272A] last:border-b-0">
                    <td className="py-2.5 pr-4 text-zinc-300">{dateStr}</td>
                    <td className="py-2.5 pr-4 text-white">{kindLabel}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-white">{estimateRange}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{routingStr}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{pausedStr}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenTest(test.testId)}
                        className={T.secondary}
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
