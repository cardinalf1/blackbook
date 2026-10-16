import { useEffect, useState } from 'react';
import { rulesNotesStore } from '../../services/storage';
import { RULES_NOTE_MAX, type RulesNotesStore } from '../../types/ai';

export interface RulesNoteBoxProps {
  skillCode: string;
  skill: string;
  store?: RulesNotesStore;
}

export function RulesNoteBox({
  skillCode,
  skill,
  store = rulesNotesStore,
}: RulesNoteBoxProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSaved(false);

    store
      .listNotes()
      .then((notes) => {
        if (!active) return;
        const note = notes.find((n) => n.skillCode === skillCode);
        setText(note?.text ?? '');
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [store, skillCode]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await store.setNote(skillCode, text);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-4 text-xs text-[#FAFAFA]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Rule note \u2022 {skill}
        </h4>
        <span className="font-mono text-[11px] text-zinc-500">
          {text.length}/{RULES_NOTE_MAX}
        </span>
      </div>

      <p className="text-zinc-400">
        Write the rule in your own words. Do not paste question text. These notes stay on this computer and are never sent to AI.
      </p>

      {error && (
        <div className="rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-400" role="alert">
          {error}
        </div>
      )}

      <div>
        <textarea
          aria-label={`Rule note for ${skill}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          maxLength={RULES_NOTE_MAX}
          disabled={loading || saving}
          rows={3}
          placeholder="Summarize the core rule or pattern in your own words..."
          className="w-full rounded-md border border-[#27272A] bg-[#0A0A0C] p-2.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          {saved && (
            <span className="font-mono text-[11px] text-emerald-400">
              Saved
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="rounded-md bg-zinc-100 px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </section>
  );
}
