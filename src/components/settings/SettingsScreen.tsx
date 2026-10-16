import { useEffect, useState } from 'react';
import { aiStore as defaultAiStore } from '../../services/storage';
import type { AiStatus, AiStore } from '../../types/ai';
import { DesmosKeySection } from './DesmosKeySection';

export interface SettingsScreenProps {
  onBack: () => void;
  store?: AiStore;
}

export function SettingsScreen({
  onBack,
  store = defaultAiStore,
}: SettingsScreenProps) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingIncludeText, setConfirmingIncludeText] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    store
      .status()
      .then((s) => {
        if (active) {
          setStatus(s);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [store]);

  useEffect(() => {
    if (!confirmingIncludeText) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmingIncludeText(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmingIncludeText]);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setBusy(true);
    setError(null);
    setTestMessage(null);
    try {
      const nextStatus = await store.setKey(keyInput.trim());
      setStatus(nextStatus);
      setKeyInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveKey = async () => {
    setBusy(true);
    setError(null);
    setTestMessage(null);
    try {
      const nextStatus = await store.removeKey();
      setStatus(nextStatus);
      setConfirmingRemove(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async () => {
    setBusy(true);
    setError(null);
    setTestMessage(null);
    try {
      const res = await store.testConnection();
      setTestMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const nextStatus = await store.updateSettings({ enabled: !status.settings.enabled });
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleIncludeText = async () => {
    if (!status) return;
    if (status.settings.includeText) {
      setBusy(true);
      setError(null);
      try {
        const nextStatus = await store.updateSettings({ includeText: false });
        setStatus(nextStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    } else {
      if (status.settings.textConfirmedAt === null) {
        setConfirmingIncludeText(true);
      } else {
        setBusy(true);
        setError(null);
        try {
          const nextStatus = await store.updateSettings({ includeText: true });
          setStatus(nextStatus);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }
    }
  };

  const handleConfirmIncludeText = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextStatus = await store.updateSettings({
        includeText: true,
        textConfirmedAt: Date.now(),
      });
      setStatus(nextStatus);
      setConfirmingIncludeText(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-[#FAFAFA]">
      {/* Header section */}
      <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
          >
            Back
          </button>
          <div>
            <h2 className="font-mono text-sm font-medium text-zinc-100">AI settings</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Optional Groq acceleration for analytics and weak-skill drilling.
            </p>
          </div>
        </div>
      </section>

      {/* Plain red line for errors */}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      {loading && !status ? (
        <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5 text-xs text-zinc-400">
          Loading settings...
        </section>
      ) : status ? (
        <>
          {/* Section 1: Groq Key */}
          <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272A] pb-3">
              <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                Groq key
              </h3>
              <span className="font-mono text-xs text-zinc-400">
                {status.hasKey ? 'A key is saved' : 'No key saved'}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter Groq API key"
                aria-label="Groq API key"
                disabled={busy}
                className="flex-1 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                disabled={busy || !keyInput.trim()}
                className="rounded-md border border-[#27272A] bg-[#0A0A0C] px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50"
              >
                Save key
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={busy}
                className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
              >
                Test connection
              </button>

              {confirmingRemove ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Remove saved key?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    disabled={busy}
                    className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    disabled={busy}
                    className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 hover:text-red-100 disabled:opacity-50"
                  >
                    Confirm remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={busy || !status.hasKey}
                  className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
                >
                  Remove key
                </button>
              )}
            </div>

            {testMessage && (
              <p className="text-xs text-zinc-300 pt-1">
                {testMessage}
              </p>
            )}
          </section>

          <DesmosKeySection />

          {/* Section 2 & 3: Settings and toggles */}
          <section className="space-y-5 rounded-lg border border-[#27272A] bg-[#121215] p-5">
            {/* Section 2: Global "Use AI features" */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="toggle-use-ai"
                    className="cursor-pointer text-sm font-medium text-zinc-100"
                  >
                    Use AI features
                  </label>
                  <p className="text-xs text-zinc-400">
                    when off or without a key, every feature runs its rule-based version.
                  </p>
                </div>
                <input
                  id="toggle-use-ai"
                  type="checkbox"
                  role="switch"
                  aria-label="Use AI features"
                  aria-checked={status.settings.enabled}
                  checked={status.settings.enabled}
                  onChange={handleToggleEnabled}
                  disabled={busy}
                  className="mt-0.5 h-5 w-5 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>

            <div className="border-t border-[#27272A]" />

            {/* Section 3: "Include question text" */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="toggle-include-text"
                    className="cursor-pointer text-sm font-medium text-zinc-100"
                  >
                    Include question text
                  </label>
                  <div className="space-y-0.5 text-xs text-zinc-400">
                    <p>{status.policyLine}</p>
                    <p>Your notes and mistake notes are never sent.</p>
                  </div>
                </div>
                <input
                  id="toggle-include-text"
                  type="checkbox"
                  role="switch"
                  aria-label="Include question text"
                  aria-checked={status.settings.includeText}
                  checked={status.settings.includeText}
                  onChange={handleToggleIncludeText}
                  disabled={busy}
                  className="mt-0.5 h-5 w-5 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500 cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Model info */}
          <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5">
            <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              Model
            </h3>
            <p className="mt-1 font-mono text-xs text-zinc-200">
              {status.model}
            </p>
          </section>
        </>
      ) : null}

      {/* Confirmation Dialog for First-Time "Include question text" */}
      {confirmingIncludeText && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-include-text-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#27272A] bg-[#121215] p-6 shadow-xl space-y-4">
            <h3 id="confirm-include-text-title" className="font-mono text-sm font-medium text-zinc-100">
              Include question text
            </h3>
            <p className="text-xs leading-relaxed text-zinc-300">
              Question text (passage, question and answer choices) goes to Groq&apos;s servers. It is the source&apos;s content, and you are sending it for your own personal practice.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingIncludeText(false)}
                disabled={busy}
                className="rounded-md border border-[#27272A] px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIncludeText}
                disabled={busy}
                className="rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
              >
                I understand, include text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
