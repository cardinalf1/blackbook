import { useEffect, useState } from 'react';
import { calculatorEngineStore } from '../../services/calculator/engine';
import { calculatorKeyStore as defaultStore } from '../../services/storage';
import type { CalculatorKeyStatus, CalculatorKeyStore } from '../../types/calculator';

const btn =
  'rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400';

/**
 * Settings: the user's own Desmos API key for the calculator (docs/calculator-spec.md). The key is
 * sent to the local program once and never shown again; only "a key is saved" comes back.
 */
export function DesmosKeySection({ store = defaultStore }: { store?: CalculatorKeyStore }) {
  const [status, setStatus] = useState<CalculatorKeyStatus | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    store
      .status()
      .then((s) => live && setStatus(s))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [store]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      // The test room picks the engine from this; keep it in step.
      void calculatorEngineStore.getState().refresh();
    }
  };

  return (
    <section id="desmos-key" className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5" aria-labelledby="desmos-key-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
        <h3 id="desmos-key-title" className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          Desmos calculator
        </h3>
        <span className="font-mono text-xs text-zinc-400">{status === null ? 'Checking...' : status.hasKey ? 'A key is saved' : 'No key saved'}</span>
      </div>

      <p className="text-xs leading-relaxed text-zinc-400">
        The calculator in Math tests and drills uses Desmos with your own API key, for your personal, non-commercial use under Desmos's free terms. Get a
        key at desmos.com/my-api. The key stays on this computer, outside your exports and backups.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Enter Desmos API key"
          aria-label="Desmos API key"
          autoComplete="off"
          disabled={busy}
          className="flex-1 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy || !keyInput.trim()}
          onClick={() =>
            void run(async () => {
              setStatus(await store.setKey(keyInput.trim()));
              setKeyInput('');
              setMessage('Saved. Press Test to check it with Desmos.');
            })
          }
          className={btn}
        >
          Save key
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !status?.hasKey} onClick={() => void run(async () => setMessage((await store.test()).message))} className={btn}>
          Test
        </button>
        {confirmingRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Remove the saved key?</span>
            <button type="button" disabled={busy} onClick={() => setConfirmingRemove(false)} className={btn}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setStatus(await store.removeKey());
                  setConfirmingRemove(false);
                  setMessage('Removed. The calculator panel will say no calculator is set up.');
                })
              }
              className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 hover:text-red-100 disabled:opacity-50"
            >
              Confirm remove
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy || !status?.hasKey} onClick={() => setConfirmingRemove(true)} className={btn}>
            Remove key
          </button>
        )}
      </div>

      {message && (
        <p className="text-xs text-zinc-300" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
