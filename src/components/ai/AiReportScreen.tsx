import { useEffect, useState } from 'react';
import { aiStore } from '../../services/storage';
import type { AiFailure, AiPreview, AiStatus, InsightReport, ReportPeriod } from '../../types/ai';

export interface AiReportScreenProps {
  onBack: () => void;
}

const PERIOD_TABS: readonly { period: ReportPeriod; label: string }[] = [
  { period: 'last_test', label: 'Last test' },
  { period: 'last_7_days', label: 'Last 7 days' },
  { period: 'all_time', label: 'All time' },
];

function fallbackMessage(reason: AiFailure): string {
  switch (reason) {
    case 'no_key':
      return 'Needs a Groq key in Settings';
    case 'off':
      return 'AI is turned off.';
    case 'rate_limited':
      return 'Rate limit reached.';
    case 'timeout':
      return 'Request timed out.';
    case 'invalid_reply':
      return 'Invalid reply received.';
    case 'network':
      return 'Network error.';
    case 'http':
      return 'HTTP error.';
    default:
      return 'Report generated with rule-based fallback.';
  }
}

export function AiReportScreen({ onBack }: AiReportScreenProps) {
  const [period, setPeriod] = useState<ReportPeriod>('last_test');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load report or force preview if not yet seen
  const loadData = async (selectedPeriod: ReportPeriod, regenerate: boolean) => {
    setError(null);
    setLoading(true);
    try {
      const currentStatus = status ?? (await aiStore.status());
      if (!status) setStatus(currentStatus);

      const seen = currentStatus?.settings.previewSeen ?? [];
      if (!seen.includes('report')) {
        // Force preview before first report
        const p = await aiStore.previewReport(selectedPeriod);
        setPreview(p);
        setShowPreview(true);
        const updated = await aiStore.updateSettings({
          previewSeen: [...seen, 'report'],
        });
        setStatus(updated);
        setLoading(false);
        return;
      }

      const rep = await aiStore.report(selectedPeriod, regenerate);
      setReport(rep);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(period, false);
  }, [period]);

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
  };

  const handleRegenerate = async () => {
    await loadData(period, true);
  };

  const handleShowPreview = async () => {
    setError(null);
    try {
      const p = await aiStore.previewReport(period);
      setPreview(p);
      setShowPreview(true);

      if (status && !status.settings.previewSeen.includes('report')) {
        const updated = await aiStore.updateSettings({
          previewSeen: [...status.settings.previewSeen, 'report'],
        });
        setStatus(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
        <div>
          <h2 className="font-mono text-sm font-medium text-zinc-100">Performance Report</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Automated insights and personalized practice recommendations.
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

      {/* Tabs and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex rounded-md border border-[#27272A] bg-[#0A0A0C] p-1 gap-1">
          {PERIOD_TABS.map((tab) => {
            const isActive = period === tab.period;
            return (
              <button
                key={tab.period}
                type="button"
                onClick={() => handlePeriodChange(tab.period)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-[#FAFAFA]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

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
            onClick={handleRegenerate}
            className="rounded-md bg-zinc-100 px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Refreshing...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300"
        >
          {error}
        </div>
      )}

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
            <div className="flex items-center gap-2">
              {!report && (
                <button
                  type="button"
                  onClick={() => loadData(period, false)}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  Generate report
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
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

      {/* Report Body */}
      {report && (
        <div className="space-y-5">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#27272A] bg-[#121215] p-4">
            <div className="flex items-center gap-3">
              <span className="rounded bg-zinc-800 px-2.5 py-0.5 font-mono text-xs font-medium text-zinc-200">
                {report.origin === 'ai' ? 'AI-assisted' : 'rule-based'}
              </span>
              {report.cached && (
                <span className="text-xs font-mono text-zinc-500">(cached)</span>
              )}
            </div>

            {/* Fallback reason note */}
            {report.fallbackReason && (
              <span className="text-xs text-amber-400">
                {fallbackMessage(report.fallbackReason)}
              </span>
            )}
          </div>

          {/* Dropped sentences message */}
          {report.dropped > 0 && (
            <div
              role="status"
              className="rounded-md border border-amber-900/50 bg-amber-950/40 p-3 text-xs text-amber-300"
            >
              {report.dropped} sentences were dropped because they used numbers that were not in the data
            </div>
          )}

          {/* Report Lines */}
          <div className="space-y-3">
            {report.lines.map((line) => (
              <article
                key={line.insightId}
                className="rounded-lg border border-[#27272A] bg-[#121215] p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-mono text-xs font-medium text-zinc-400 uppercase">
                    {line.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {line.thin && (
                      <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 border border-zinc-700/60">
                        thin data
                      </span>
                    )}
                    <span className="font-mono text-xs text-zinc-500">
                      Sample size: {line.sampleSize}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-[#FAFAFA]">{line.headline}</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">{line.sentence}</p>
              </article>
            ))}
          </div>

          {/* What to do next week */}
          {report.nextWeek && (
            <section className="rounded-lg border border-[#27272A] bg-[#121215] p-5 space-y-2">
              <h3 className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wide">
                What to do next week
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {report.nextWeek}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
