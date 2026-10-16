import { useEffect, useId, useMemo, useState } from 'react';
import { startWeakDrill } from '../../services/modes/load';
import { aiStore } from '../../services/storage';
import type { AiPreview, AiStatus, WeakDrillRequest, WeakDrillResult } from '../../types/ai';
import type { Section } from '../../types/sat';

export interface WeakDrillScreenProps {
  onBack: () => void;
  onStarted: () => void;
}

export function WeakDrillScreen({ onBack, onStarted }: WeakDrillScreenProps) {
  const sectionSelectId = useId();
  const sizeInputId = useId();
  const ruleOnlyId = useId();

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [section, setSection] = useState<Section | 'both'>('both');
  const [sizeInput, setSizeInput] = useState<string>('20');
  const [ruleOnly, setRuleOnly] = useState<boolean>(false);

  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [result, setResult] = useState<WeakDrillResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    aiStore
      .status()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const size = useMemo(() => {
    const parsed = parseInt(sizeInput, 10);
    if (Number.isNaN(parsed)) return 20;
    return Math.max(5, Math.min(40, parsed));
  }, [sizeInput]);

  const request: WeakDrillRequest = useMemo(
    () => ({
      section,
      size,
      ruleOnly,
    }),
    [section, size, ruleOnly],
  );

  const handleShowPreview = async () => {
    setError(null);
    try {
      const p = await aiStore.preview('weak_drill', request);
      setPreview(p);
      setShowPreview(true);

      if (status && !status.settings.previewSeen.includes('weak_drill')) {
        const updated = await aiStore.updateSettings({
          previewSeen: [...status.settings.previewSeen, 'weak_drill'],
        });
        setStatus(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleBuildDrill = async () => {
    setError(null);
    setLoading(true);
    try {
      const currentStatus = status ?? (await aiStore.status());
      const seen = currentStatus?.settings.previewSeen ?? [];

      if (!seen.includes('weak_drill')) {
        // Force preview before first build
        const p = await aiStore.preview('weak_drill', request);
        setPreview(p);
        setShowPreview(true);
        const updated = await aiStore.updateSettings({
          previewSeen: [...seen, 'weak_drill'],
        });
        setStatus(updated);
        setLoading(false);
        return;
      }

      const res = await aiStore.weakDrill(request);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStartDrill = async () => {
    if (!result) return;
    setLoading(true);
    try {
      await startWeakDrill(result);
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const isAiOffOrNoKey = status && (!status.hasKey || !status.settings.enabled);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
        <div>
          <h2 className="font-mono text-sm font-medium text-zinc-100">Weak-Skill Drill</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Build a targeted practice set from your weakest skills.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back
        </button>
      </div>

      {isAiOffOrNoKey && (
        <div
          role="status"
          className="rounded-md border border-amber-900/50 bg-amber-950/40 p-3 text-xs text-amber-300"
        >
          Needs a Groq key in Settings (AI is off). The rule-based version runs instead.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300"
        >
          {error}
        </div>
      )}

      {/* Drill Setup Controls */}
      <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label htmlFor={sectionSelectId} className="block space-y-1">
            <span className="text-xs text-zinc-400">Section</span>
            <select
              id={sectionSelectId}
              value={section}
              onChange={(e) => setSection(e.target.value as Section | 'both')}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 text-xs text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none"
            >
              <option value="both">Both</option>
              <option value="rw">Reading and Writing</option>
              <option value="math">Math</option>
            </select>
          </label>

          <label htmlFor={sizeInputId} className="block space-y-1">
            <span className="text-xs text-zinc-400">Size (5 to 40)</span>
            <input
              id={sizeInputId}
              type="number"
              min={5}
              max={40}
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onBlur={() => setSizeInput(String(size))}
              className="block w-full rounded-md border border-[#27272A] bg-[#0A0A0C] px-2.5 py-1.5 font-mono text-xs text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-[#27272A] pt-3">
          <label
            htmlFor={ruleOnlyId}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              id={ruleOnlyId}
              type="checkbox"
              checked={ruleOnly}
              onChange={(e) => setRuleOnly(e.target.checked)}
              className="h-4 w-4 rounded border border-[#27272A] bg-[#0A0A0C] text-zinc-100 accent-zinc-500"
            />
            <span>Rule-based only</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShowPreview}
              className="rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Show exactly what will be sent
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleBuildDrill}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Building...' : 'Build drill'}
            </button>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      {showPreview && preview && (
        <section
          aria-label="Request preview"
          className="space-y-3 rounded-lg border border-[#27272A] bg-[#121215] p-5"
        >
          <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
            <h3 className="font-mono text-xs font-medium text-zinc-200">
              Payload Preview ({preview.feature})
            </h3>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-300">
            <div>
              <span className="text-zinc-500">Questions: </span>
              {preview.questionCount}
            </div>
            <div>
              <span className="text-zinc-500">Approx tokens: </span>
              {preview.approxTokens}
            </div>
            <div>
              <span className="text-zinc-500">Question text: </span>
              {preview.usedText ? 'Included' : 'Not included'}
            </div>
          </div>

          <pre className="max-h-60 overflow-auto rounded border border-[#27272A] bg-[#0A0A0C] p-3 font-mono text-xs text-zinc-300">
            {JSON.stringify(preview.body, null, 2)}
          </pre>
        </section>
      )}

      {/* Drill Results Breakdown */}
      {result && (
        <section className="space-y-4 rounded-lg border border-[#27272A] bg-[#121215] p-5">
          <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
            <div>
              <h3 className="font-mono text-sm font-semibold text-[#FAFAFA]">Drill Built</h3>
              <p className="text-xs text-zinc-400">
                {result.questionIds.length} questions selected
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs font-medium text-zinc-200">
                {result.origin === 'ai' ? 'AI-assisted' : 'rule-based'}
              </span>
            </div>
          </div>

          {/* Fallback notes */}
          {(result.fallbackReason || result.notes.length > 0) && (
            <div className="rounded-md border border-zinc-800 bg-[#0A0A0C] p-3 text-xs text-zinc-400 space-y-1">
              {result.fallbackReason && (
                <p>
                  {result.fallbackReason === 'no_key'
                    ? 'Needs a Groq key in Settings'
                    : `Fallback reason: ${result.fallbackReason}`}
                </p>
              )}
              {result.notes.map((note, idx) => (
                <p key={idx}>{note}</p>
              ))}
            </div>
          )}

          {/* Skills table */}
          {result.skills.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-medium text-zinc-300 uppercase">Skills</h4>
              <div className="overflow-x-auto rounded border border-[#27272A] bg-[#0A0A0C]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#27272A] text-zinc-500 font-mono">
                    <tr>
                      <th className="p-2.5">Skill</th>
                      <th className="p-2.5 text-right">Correct of answered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]/50 text-zinc-300">
                    {result.skills.map((s) => (
                      <tr key={s.skillCode}>
                        <td className="p-2.5">{s.skill}</td>
                        <td className="p-2.5 text-right font-mono">
                          {s.correct} of {s.answered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Groups */}
          {result.groups.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-mono text-xs font-medium text-zinc-300 uppercase">Groups</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.groups.map((group, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-[#27272A] bg-[#0A0A0C] p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold text-zinc-200">{group.label}</span>
                      <span className="text-zinc-500">{group.questionIds.length} questions</span>
                    </div>
                    <p className="text-zinc-400">{group.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Drill action */}
          <div className="flex justify-end pt-3 border-t border-[#27272A]">
            <button
              type="button"
              disabled={loading}
              onClick={handleStartDrill}
              className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Starting...' : 'Start this drill'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
