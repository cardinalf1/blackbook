import { useEffect, useMemo, useState } from 'react';
import { EXAM_MODULES } from '../../config/examConfig';
import { loadRows } from '../../services/browse/rows';
import { assembleModule } from '../../services/exam/assemble';
import { moduleDurationMs } from '../../services/test/devOverrides';
import type { BrowseRow } from '../../types/browse';
import type { AssembledModule, ExamModuleSpec } from '../../types/exam';
import type { Section } from '../../types/sat';
import { formatDuration } from '../../utils/formatDuration';

const SECTION_LABEL: Record<Section, string> = { rw: 'Reading and Writing', math: 'Math' };

/** Choose a section, see what was assembled (and any shortfall), then start the clock. */
export function ExamSetup({ onStart, onCancel }: { onStart: (m: AssembledModule, durationMs: number) => void; onCancel: () => void }) {
  const [rows, setRows] = useState<BrowseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('rw');
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    loadRows().then(setRows, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Reassembled when the section changes or "Pick other questions" bumps the seed; stable otherwise.
  const assembled = useMemo(() => {
    void seed;
    const spec: ExamModuleSpec = { section, moduleNumber: 1, tier: 'routing' };
    return rows ? assembleModule(rows, spec, Math.random) : null;
  }, [rows, section, seed]);
  const durationMs = moduleDurationMs(section);
  const shape = EXAM_MODULES[section];

  if (error) return <div className="rounded-lg border border-red-900/50 bg-[#121215] p-5 text-sm text-red-400" role="alert">Could not load the questions: {error}</div>;
  if (!assembled) return <div className="rounded-lg border border-[#27272A] bg-[#121215] p-6 text-center text-sm text-zinc-400">Loading questions...</div>;

  return (
    <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-6">
      <div>
        <h2 className="font-mono text-sm text-zinc-100">Practice module</h2>
        <p className="mt-1 text-sm text-zinc-400">
          One timed module under test conditions: no answers or explanations until you submit, and no going back after. The clock keeps
          running if you close the tab.
        </p>
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-xs text-zinc-400">Section</legend>
        {(['rw', 'math'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={section === s}
            onClick={() => setSection(s)}
            className={`rounded-md border px-4 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              section === s ? 'border-zinc-300 bg-zinc-800 text-zinc-100' : 'border-[#27272A] text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
      </fieldset>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
          <dt className="text-xs text-zinc-400">Questions</dt>
          <dd className="font-mono text-zinc-100">{assembled.questionIds.length} of {shape.questions}</dd>
        </div>
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
          <dt className="text-xs text-zinc-400">Time</dt>
          <dd className="font-mono text-zinc-100">{formatDuration(durationMs)}</dd>
        </div>
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
          <dt className="text-xs text-zinc-400">New to you</dt>
          <dd className="font-mono text-zinc-100">{assembled.freshness.fresh}</dd>
        </div>
        <div className="rounded-md border border-[#27272A] bg-[#0A0A0C] p-3">
          <dt className="text-xs text-zinc-400">Seen or done before</dt>
          <dd className="font-mono text-zinc-100">{assembled.freshness.soft + assembled.freshness.consumed}</dd>
        </div>
      </dl>

      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-400">
          <tr>
            <th className="py-1 font-normal">Domain</th>
            <th className="py-1 font-normal">Questions</th>
          </tr>
        </thead>
        <tbody>
          {assembled.domains.map((d) => (
            <tr key={d.code} className="border-t border-[#27272A]">
              <td className="py-1.5 text-zinc-200">{d.label}</td>
              <td className={`py-1.5 font-mono ${d.actual < d.planned ? 'text-amber-300' : 'text-zinc-300'}`}>
                {d.actual}
                {d.actual < d.planned && ` of ${d.planned}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {assembled.notes.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200" role="status">
          {assembled.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {durationMs !== shape.durationMs && (
        <p className="text-xs text-amber-300">Dev build: module time shortened for testing ({formatDuration(durationMs)}).</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={assembled.questionIds.length === 0}
          onClick={() => onStart(assembled, durationMs)}
          className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Start the clock
        </button>
        <button
          type="button"
          onClick={() => setSeed((n) => n + 1)}
          className="rounded-md border border-[#27272A] px-4 py-1.5 text-sm text-zinc-200 hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Pick other questions
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-1.5 py-0.5 text-sm text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
