import { useMemo, useRef, useState } from 'react';
import { importBankText, type ImportResult, type ImportStage } from '../services/import/importBank';
import { createSanitizer } from '../services/normalize/sanitize';
import { questionStore } from '../services/storage';

const STAGE_LABEL: Record<ImportStage, string> = { reading: 'Reading file', validating: 'Checking questions', saving: 'Saving' };
const SHOW_INVALID = 20;

export function ImportPanel({ onImported }: { onImported: () => void }) {
  const sanitize = useMemo(() => createSanitizer(window), []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ stage: ImportStage; done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onFile = async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const r = await importBankText(text, {
        store: questionStore,
        sanitize,
        signal: controller.signal,
        onProgress: (stage, done, total) => setProgress({ stage, done, total }),
      });
      setResult(r);
      if (r.ok) onImported();
    } catch (e) {
      setResult({ ok: false, error: `Could not read the file: ${e instanceof Error ? e.message : String(e)}`, invalid: [] });
    } finally {
      abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
      <div>
        <h2 className="font-mono text-sm">Import question bank</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose the <code>data/question_bank.json</code> file made by <code>bun run sync</code>. Questions stay in this
          browser. Importing replaces the current bank.
        </p>
      </div>

      <input
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFile(f);
        }}
        className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-900"
      />

      {progress && (
        <div className="space-y-1" role="status">
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span>
              {STAGE_LABEL[progress.stage]} {progress.total > 1 && `${progress.done} / ${progress.total}`}
            </span>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-md border border-[#27272A] px-2.5 py-1 text-zinc-200 hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
            <div className="h-full bg-zinc-200 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {result?.ok === true && (
        <p className="text-sm text-emerald-400" role="status">
          Imported {result.imported} questions.
          {result.skippedBySync > 0 && ` The sync left out ${result.skippedBySync} questions it could not use safely.`}
        </p>
      )}
      {result?.ok === false && (
        <p className={`text-sm ${result.cancelled ? 'text-zinc-300' : 'text-red-400'}`} role="alert">
          {result.error}
        </p>
      )}
      {result && result.invalid.length > 0 && (
        <details className="text-sm" open={!result.ok}>
          <summary className="cursor-pointer text-amber-400">
            {result.invalid.length} {result.invalid.length === 1 ? 'entry was' : 'entries were'} rejected
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-400">
            {result.invalid.slice(0, SHOW_INVALID).map((i) => (
              <li key={i.index}>
                #{i.index} {i.id ?? '(no id)'}: {i.errors.join('; ')}
              </li>
            ))}
            {result.invalid.length > SHOW_INVALID && <li>and {result.invalid.length - SHOW_INVALID} more</li>}
          </ul>
        </details>
      )}
    </section>
  );
}
