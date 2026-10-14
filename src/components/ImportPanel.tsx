import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../services/api/client';
import type { ImportResult } from '../services/import/importBank';

const SHOW_INVALID = 20;

/** Sends a question bank file to the local program, which checks it and swaps it in atomically. */
export function ImportPanel({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  const onFile = async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setElapsed(0);
    setResult(null);
    try {
      const r = await api.request<ImportResult>('/api/bank/import', {
        method: 'POST',
        body: file,
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
      });
      setResult(r);
      if (r.ok) onImported();
    } catch (e) {
      if (controller.signal.aborted) {
        setResult({ ok: false, error: 'Import cancelled. The previous bank was kept.', invalid: [], cancelled: true });
      } else {
        setResult({ ok: false, error: e instanceof ApiError ? e.message : `Could not import the file: ${String(e)}`, invalid: [] });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
      <div>
        <h2 className="font-mono text-sm">Import question bank</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a <code>question_bank.json</code> file made by <code>bun run sync</code>. It is checked and saved on this
          computer. Importing replaces the current bank.
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

      {busy && (
        <div className="space-y-1" role="status">
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span>Checking and saving questions ({elapsed} s). A full bank takes about half a minute.</span>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-md border border-[#27272A] px-2.5 py-1 text-zinc-200 hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800">
            <div className="h-full w-1/3 animate-pulse bg-zinc-200" />
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
