import { useEffect, useState } from 'react';
import { loadMistakeItems, tagMistake } from '../../services/mistakes/load';
import {
  MISTAKE_NOTE_MAX,
  MISTAKE_REASONS,
  MISTAKE_REASON_LABEL,
  type MistakeItem,
  type MistakeReason,
} from '../../types/mistakes';
import type { SessionReport, SessionSource } from '../../types/session';

export interface MistakeReviewPanelProps {
  report: SessionReport;
  source: SessionSource;
  defaultExpanded?: boolean;
}

export function MistakeReviewPanel({
  report,
  source,
  defaultExpanded = false,
}: MistakeReviewPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(!defaultExpanded);
  const [items, setItems] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReasons, setSelectedReasons] = useState<Record<string, MistakeReason>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadMistakeItems(report, source)
      .then((res) => {
        if (active) {
          setItems(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [report, source]);

  const handleUseSuggestion = async (item: MistakeItem) => {
    if (!item.suggestion) return;
    setSavingIds((prev) => new Set(prev).add(item.questionId));
    try {
      const saved = await tagMistake({
        sessionId: item.sessionId,
        questionId: item.questionId,
        mode: report.mode,
        reason: item.suggestion.reason,
        note: '',
        suggested: true,
        previous: item.tag,
      });
      setSaveError(null);
      setItems((prev) =>
        prev.map((it) =>
          it.questionId === item.questionId ? { ...it, tag: saved, suggestion: null } : it,
        ),
      );
    } catch (e) {
      setSaveError(`Could not save the tag: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.questionId);
        return next;
      });
    }
  };

  const handleSaveTag = async (item: MistakeItem) => {
    const reason = selectedReasons[item.questionId] ?? item.tag?.reason;
    if (!reason) return;
    const note = notes[item.questionId] ?? item.tag?.note ?? '';
    setSavingIds((prev) => new Set(prev).add(item.questionId));
    try {
      const saved = await tagMistake({
        sessionId: item.sessionId,
        questionId: item.questionId,
        mode: report.mode,
        reason,
        note,
        suggested: false,
        previous: item.tag,
      });
      setSaveError(null);
      setItems((prev) =>
        prev.map((it) =>
          it.questionId === item.questionId ? { ...it, tag: saved, suggestion: null } : it,
        ),
      );
    } catch (e) {
      setSaveError(`Could not save the tag: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.questionId);
        return next;
      });
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#27272A] bg-[#121215] text-[#FAFAFA]">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-300">
            Review mistakes
          </h3>
          {!loading && items.length > 0 && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {items.length}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-400">{isCollapsed ? 'Show' : 'Hide'}</span>
      </button>

      {!isCollapsed && (
        <div className="border-t border-[#27272A] p-4">
          {loading ? (
            <p className="text-xs text-zinc-500">Loading mistake review...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No missed or unanswered questions in this session.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">Tagging is optional. Nothing here is saved until you press a button.</p>
              {saveError && (
                <p role="alert" className="text-xs text-red-400">
                  {saveError}
                </p>
              )}
              {items.map((item) => {
                const reportItem = report.items.find((r) => r.questionId === item.questionId);
                const displayId = reportItem?.displayId ?? item.questionId;
                const skill = reportItem?.skill ?? '';
                const currentReason = selectedReasons[item.questionId] ?? item.tag?.reason ?? '';
                const currentNote = notes[item.questionId] ?? item.tag?.note ?? '';
                const isSaving = savingIds.has(item.questionId);

                return (
                  <div
                    key={item.questionId}
                    data-testid={`mistake-item-${item.questionId}`}
                    className="space-y-3 rounded-md border border-[#27272A] bg-[#0A0A0C] p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-zinc-300">
                        {item.index + 1}
                      </span>
                      <span className="font-mono text-zinc-400">#{displayId}</span>
                      {skill && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-200">{skill}</span>
                        </>
                      )}
                      {item.unanswered && (
                        <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          Unanswered
                        </span>
                      )}
                    </div>

                    {item.tag ? (
                      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-[#121215] px-2.5 py-1.5 text-zinc-300">
                        <span className="text-zinc-400">Current tag:</span>
                        <span className="font-semibold text-zinc-200">
                          {MISTAKE_REASON_LABEL[item.tag.reason]}
                        </span>
                        {item.tag.note && (
                          <span className="text-zinc-400 italic">"{item.tag.note}"</span>
                        )}
                      </div>
                    ) : item.suggestion ? (
                      <div className="space-y-2 rounded border border-zinc-800 bg-[#121215] p-2.5">
                        <p className="text-zinc-300">{item.suggestion.why}</p>
                        <p className="text-[11px] text-zinc-500">This is only a suggestion.</p>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUseSuggestion(item)}
                          className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                        >
                          Use suggestion: {MISTAKE_REASON_LABEL[item.suggestion.reason]}
                        </button>
                      </div>
                    ) : null}

                    {/* Reason picker, note input, and save */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        aria-label="Reason"
                        value={currentReason}
                        disabled={isSaving}
                        onChange={(e) =>
                          setSelectedReasons((prev) => ({
                            ...prev,
                            [item.questionId]: e.target.value as MistakeReason,
                          }))
                        }
                        className="rounded border border-[#27272A] bg-[#121215] px-2.5 py-1 text-xs text-zinc-200 transition-colors focus:border-zinc-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          Pick a reason
                        </option>
                        {MISTAKE_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {MISTAKE_REASON_LABEL[reason]}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        aria-label="Note"
                        maxLength={MISTAKE_NOTE_MAX}
                        placeholder="Add a note (optional)"
                        value={currentNote}
                        disabled={isSaving}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [item.questionId]: e.target.value,
                          }))
                        }
                        className="min-w-[180px] flex-1 rounded border border-[#27272A] bg-[#121215] px-2.5 py-1 text-xs text-zinc-200 transition-colors placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                      />

                      <button
                        type="button"
                        disabled={isSaving || currentReason === ''}
                        onClick={() => handleSaveTag(item)}
                        className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 font-mono text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50"
                      >
                        {item.tag ? 'Update tag' : 'Save tag'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
