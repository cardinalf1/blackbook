// Test history screen: score estimate ranges over time for Reading and Writing, Math, and Total.
// Separate RangeBars charts with routing outcomes, paused tags, scoring config version legends,
// and mixed scoring version warning banners. Every score is an estimate range, never an exact score.

import { estimateVersions } from '../../services/analytics/metrics';
import type { TestHistoryRow, TestHistoryScreenProps } from '../../types/analytics';
import { RangeBars, type RangeBarItem } from './charts/RangeBars';

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

export function TestHistoryScreen({ history }: TestHistoryScreenProps) {
  const testsWithEstimate = history.tests.filter((t) => t.estimate !== null);

  if (testsWithEstimate.length === 0) {
    return (
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-8 text-center text-[#FAFAFA]">
        <h2 className="font-mono text-sm font-semibold text-zinc-200">Test History</h2>
        <p className="mt-2 text-xs text-zinc-400">
          No finished tests yet. Complete a practice test or section run to see your score estimates.
        </p>
      </section>
    );
  }

  const { mixed, versions } = estimateVersions(history.tests);

  // 1. Reading and Writing range items
  const rwItems: RangeBarItem[] = [];
  testsWithEstimate.forEach((t: TestHistoryRow) => {
    const secEst = t.estimate?.sections.find((s) => s.section === 'rw');
    if (!secEst) return;
    const route = t.routing.find((r) => r.section === 'rw')?.route ?? secEst.route;
    const notes: string[] = [];
    if (t.paused) notes.push('paused');
    if (route) notes.push(`Module 2: ${route}`);

    rwItems.push({
      id: `${t.testId}-rw`,
      label: `${formatDate(t.finishedAt)} · ${t.kind}`,
      low: secEst.low,
      high: secEst.high,
      mid: secEst.mid,
      groupId: `v${t.configVersion}`,
      groupLabel: `scoring v${t.configVersion}`,
      valueLabel: `estimate ${secEst.low} to ${secEst.high}`,
      notes,
    });
  });

  // 2. Math range items
  const mathItems: RangeBarItem[] = [];
  testsWithEstimate.forEach((t: TestHistoryRow) => {
    const secEst = t.estimate?.sections.find((s) => s.section === 'math');
    if (!secEst) return;
    const route = t.routing.find((r) => r.section === 'math')?.route ?? secEst.route;
    const notes: string[] = [];
    if (t.paused) notes.push('paused');
    if (route) notes.push(`Module 2: ${route}`);

    mathItems.push({
      id: `${t.testId}-math`,
      label: `${formatDate(t.finishedAt)} · ${t.kind}`,
      low: secEst.low,
      high: secEst.high,
      mid: secEst.mid,
      groupId: `v${t.configVersion}`,
      groupLabel: `scoring v${t.configVersion}`,
      valueLabel: `estimate ${secEst.low} to ${secEst.high}`,
      notes,
    });
  });

  // 3. Total range items (total only from tests that have a total)
  const totalItems: RangeBarItem[] = [];
  testsWithEstimate.forEach((t: TestHistoryRow) => {
    const totalEst = t.estimate?.total;
    if (!totalEst) return;
    const notes: string[] = [];
    if (t.paused) notes.push('paused');

    totalItems.push({
      id: `${t.testId}-total`,
      label: `${formatDate(t.finishedAt)} · ${t.kind}`,
      low: totalEst.low,
      high: totalEst.high,
      mid: totalEst.mid,
      groupId: `v${t.configVersion}`,
      groupLabel: `scoring v${t.configVersion}`,
      valueLabel: `estimate ${totalEst.low} to ${totalEst.high}`,
      notes,
    });
  });

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      {/* Warning banner for mixed scoring config versions */}
      {mixed && (
        <div
          role="alert"
          className="rounded-lg border border-amber-800/80 bg-amber-950/40 p-4 font-mono text-xs text-amber-200"
        >
          <span className="font-semibold text-amber-100">Notice: </span>
          These estimates were made with different scoring settings ({versions.map((v) => `v${v}`).join(', ')}) and are not comparable with each other.
        </div>
      )}

      {/* Reading and Writing Chart */}
      <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">
            Reading and Writing Score Estimates
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Estimated score ranges (200–800) by test date. Mid tick marks range midpoint.
          </p>
        </div>
        {rwItems.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">No Reading and Writing estimates yet.</p>
        ) : (
          <RangeBars
            label="Reading and Writing score estimate history"
            items={rwItems}
            min={200}
            max={800}
            step={100}
          />
        )}
      </section>

      {/* Math Chart */}
      <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">
            Math Score Estimates
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Estimated score ranges (200–800) by test date. Mid tick marks range midpoint.
          </p>
        </div>
        {mathItems.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">No Math estimates yet.</p>
        ) : (
          <RangeBars
            label="Math score estimate history"
            items={mathItems}
            min={200}
            max={800}
            step={100}
          />
        )}
      </section>

      {/* Total Score Chart */}
      <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div>
          <h2 className="font-mono text-sm font-semibold text-zinc-100">
            Total Score Estimates
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Combined estimated score ranges (400–1600) from full tests. Mid tick marks range midpoint.
          </p>
        </div>
        {totalItems.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">
            No total score estimates yet (complete both sections in a full test).
          </p>
        ) : (
          <RangeBars
            label="Total score estimate history"
            items={totalItems}
            min={400}
            max={1600}
            step={200}
          />
        )}
      </section>
    </div>
  );
}
