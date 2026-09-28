import React, { useState } from 'react';
import { SessionRecord, ModuleStage } from '../../types/sat';
import { evaluateAnswer } from '../../services/testAssembly';
import { useThemeStore } from '../../stores/themeStore';
import { Clock, AlertCircle, Zap, ShieldAlert, Check, X } from 'lucide-react';

interface PacingTimelineProps {
  session: SessionRecord;
}

export const PacingTimeline: React.FC<PacingTimelineProps> = ({ session }) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const [selectedStage, setSelectedStage] = useState<ModuleStage>('rw_m1');

  const currentMod = session.telemetry_blob.modules[selectedStage];
  const questions = currentMod?.questions || [];
  const responses = currentMod?.responses || {};
  const telemetry = currentMod?.telemetry || {};

  // Compute pacing anomalies
  let paralysisCount = 0;
  let rushCount = 0;
  let totalDwellMs = 0;

  questions.forEach((q) => {
    const telem = telemetry[q.id];
    const resp = responses[q.id];
    const dwellSec = (telem?.dwell_time_ms || 0) / 1000;
    const isCorrect = evaluateAnswer(resp?.answer, q.correct_answer, q.format);

    totalDwellMs += telem?.dwell_time_ms || 0;

    if (dwellSec > 100) paralysisCount++;
    if (dwellSec < 30 && !isCorrect) rushCount++;
  });

  const avgDwellSec = questions.length > 0 ? Math.round(totalDwellMs / questions.length / 1000) : 0;
  const targetPace = selectedStage.startsWith('rw') ? 71 : 95; // 71s for RW, 95s for Math

  const stageLabels: Record<ModuleStage, string> = {
    rw_m1: 'RW Module 1',
    rw_m2: 'RW Module 2',
    math_m1: 'Math Module 1',
    math_m2: 'Math Module 2',
  };

  return (
    <div
      className={`rounded-2xl border p-6 md:p-8 space-y-6 shadow-md ${
        isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-inherit pb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Behavioral Pacing & Dwell Timeline
          </h3>
          <p className="text-xs opacity-70">
            Micro-telemetry analysis detecting dwell paralysis (&gt;100s) and rush misreads (&lt;30s incorrect)
          </p>
        </div>

        {/* Stage Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-inherit bg-zinc-500/10">
          {(['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] as ModuleStage[]).map((stg) => (
            <button
              key={stg}
              onClick={() => setSelectedStage(stg)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStage === stg
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {stageLabels[stg]}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="text-xs opacity-70 mb-1">Average Dwell Time</div>
          <div className="text-2xl font-bold font-mono">
            {avgDwellSec}s{' '}
            <span className="text-xs font-normal opacity-60">/ target {targetPace}s</span>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            paralysisCount > 0
              ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
              : isDark
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="text-xs opacity-70 mb-1 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Time Paralysis (&gt;100s)</span>
          </div>
          <div className="text-2xl font-bold font-mono">{paralysisCount} Questions</div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            rushCount > 0
              ? 'border-rose-500/40 bg-rose-950/20 text-rose-300'
              : isDark
              ? 'border-zinc-800 bg-zinc-900/50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="text-xs opacity-70 mb-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Rush / Misread (&lt;30s Incorrect)</span>
          </div>
          <div className="text-2xl font-bold font-mono">{rushCount} Questions</div>
        </div>
      </div>

      {/* Interactive Item-by-Item Pacing Chart */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs opacity-70">
          <span>Question Dwell Breakdown (Max 150s Bar Scale)</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Incorrect
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Paralysis (&gt;100s)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-2">
          {questions.map((q, idx) => {
            const telem = telemetry[q.id];
            const resp = responses[q.id];
            const dwellSec = Math.round((telem?.dwell_time_ms || 0) / 1000);
            const isCorrect = evaluateAnswer(resp?.answer, q.correct_answer, q.format);
            const isParalysis = dwellSec > 100;
            const isRush = dwellSec < 30 && !isCorrect;

            // Percentage bar capped at 150 seconds
            const barWidth = Math.min(100, Math.max(5, (dwellSec / 150) * 100));

            return (
              <div
                key={q.id}
                className={`p-2.5 rounded-xl border flex items-center gap-3 text-xs transition-colors ${
                  isDark ? 'border-zinc-800 bg-[#0A0A0C]' : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Question index & indicator */}
                <div className="w-8 font-mono font-bold shrink-0 flex items-center gap-1">
                  <span>Q{idx + 1}</span>
                  {isCorrect ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <X className="w-3 h-3 text-rose-500" />
                  )}
                </div>

                {/* Progress Visual Bar */}
                <div className="flex-1 h-3 rounded-full bg-zinc-700/30 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isParalysis
                        ? 'bg-amber-500'
                        : isRush
                        ? 'bg-rose-500'
                        : isCorrect
                        ? 'bg-emerald-500'
                        : 'bg-zinc-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                  {/* Target Pace Marker line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-60"
                    style={{ left: `${(targetPace / 150) * 100}%` }}
                    title={`Target pace: ${targetPace}s`}
                  />
                </div>

                {/* Time & Badges */}
                <div className="w-24 text-right font-mono shrink-0 flex items-center justify-end gap-1.5">
                  <span className="font-semibold">{dwellSec}s</span>
                  {isParalysis && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      SLOW
                    </span>
                  )}
                  {isRush && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                      RUSH
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
