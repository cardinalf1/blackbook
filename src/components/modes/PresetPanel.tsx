import { useEffect, useState } from 'react';
import { loadCleanSetStats, startPreset } from '../../services/modes/load';
import { PRESETS, type CleanSetStats, type PresetSpec } from '../../services/modes/presets';
import type { PresetId } from '../../types/drill';
import { CleanSetCard } from './CleanSetCard';

export interface PresetPanelProps {
  onStarted: () => void;
}

export function PresetPanel({ onStarted }: PresetPanelProps) {
  const presetList: PresetSpec[] = Object.values(PRESETS);

  const [counts, setCounts] = useState<Record<PresetId, number>>(() => ({
    math800: PRESETS.math800.defaultCount,
    english800: PRESETS.english800.defaultCount,
    conventions: PRESETS.conventions.defaultCount,
  }));

  const [stats, setStats] = useState<Record<PresetId, CleanSetStats | null>>({
    math800: null,
    english800: null,
    conventions: null,
  });

  const [startingId, setStartingId] = useState<PresetId | null>(null);

  useEffect(() => {
    let active = true;
    for (const preset of presetList) {
      loadCleanSetStats(preset.id)
        .then((s) => {
          if (active) {
            setStats((prev) => ({ ...prev, [preset.id]: s }));
          }
        })
        .catch(() => {
          // Keep null if failed or mock not available
        });
    }
    return () => {
      active = false;
    };
  }, []);

  const handleCountChange = (id: PresetId, rawValue: string) => {
    const parsed = parseInt(rawValue, 10);
    const valid = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    setCounts((prev) => ({ ...prev, [id]: valid }));
  };

  const handleStart = async (id: PresetId) => {
    setStartingId(id);
    try {
      await startPreset(id, counts[id]);
      onStarted();
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {presetList.map((preset) => {
        const currentStats = stats[preset.id];
        const isStarting = startingId === preset.id;
        const inputId = `preset-count-${preset.id}`;

        return (
          <div
            key={preset.id}
            className="rounded-lg border border-[#27272A] bg-[#121215] p-4 space-y-3 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-semibold text-[#FAFAFA]">{preset.title}</h3>
                <p className="text-xs text-zinc-400 max-w-xl">{preset.blurb}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span>Count</span>
                  <input
                    id={inputId}
                    type="number"
                    min={1}
                    value={counts[preset.id]}
                    onChange={(e) => handleCountChange(preset.id, e.target.value)}
                    className="w-16 rounded border border-[#27272A] bg-[#0A0A0C] px-2 py-1 font-mono text-xs text-[#FAFAFA] focus:border-zinc-500 focus:outline-none"
                  />
                </label>

                <button
                  type="button"
                  disabled={isStarting}
                  onClick={() => handleStart(preset.id)}
                  className="rounded bg-zinc-100 px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-950 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  {isStarting ? 'Starting...' : 'Start'}
                </button>
              </div>
            </div>

            {currentStats && <CleanSetCard stats={currentStats} />}
          </div>
        );
      })}
    </div>
  );
}
