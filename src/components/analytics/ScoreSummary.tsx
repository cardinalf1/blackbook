import React from 'react';
import { SessionRecord } from '../../types/sat';
import { calculateSATPercentile } from '../../services/scoring';
import { useThemeStore } from '../../stores/themeStore';
import { Award, TrendingUp, Target, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ScoreSummaryProps {
  session: SessionRecord;
}

export const ScoreSummary: React.FC<ScoreSummaryProps> = ({ session }) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const percentile = calculateSATPercentile(session.composite_score);

  return (
    <div className="space-y-6">
      {/* Composite Score Card */}
      <div
        className={`rounded-2xl border p-8 shadow-xl relative overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-[#121215] to-[#181822] border-[#27272A]'
            : 'bg-gradient-to-br from-white to-blue-50/50 border-gray-200'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className="w-6 h-6 text-blue-500" />
              <span className="text-xs uppercase tracking-widest font-mono font-bold opacity-60">
                Official Digital SAT Concordance
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black font-mono tracking-tight text-blue-500">
              {session.composite_score}
            </h2>
            <p className="text-xs opacity-75">
              Score Scale: 400–1600 &bull; 2PL IRT Latent Trait Estimation
            </p>
          </div>

          {/* Percentile Metric */}
          <div
            className={`p-4 md:p-6 rounded-xl border flex items-center gap-4 ${
              isDark ? 'border-zinc-800 bg-[#0A0A0C]/80' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono">{percentile}th</div>
              <div className="text-xs opacity-70">Nationally Representative Percentile</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Score Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reading & Writing Section */}
        <div
          className={`rounded-2xl border p-6 space-y-4 shadow-md ${
            isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between border-b border-inherit pb-3">
            <div>
              <h3 className="font-bold text-base">Reading and Writing</h3>
              <p className="text-xs opacity-60">Section 1 (54 Questions)</p>
            </div>
            <div className="text-3xl font-extrabold font-mono text-blue-400">
              {session.rw_score}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 1 Raw Score</span>
              <span className="font-mono font-semibold">
                {session.rw_m1_raw} / {session.rw_m1_total} ({Math.round((session.rw_m1_raw / (session.rw_m1_total || 1)) * 100)}%)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 2 Routing Gate</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] font-mono ${
                  session.rw_m2_route === 'Hard'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                Module 2 ({session.rw_m2_route})
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 2 Raw Score</span>
              <span className="font-mono font-semibold">
                {session.rw_m2_raw} / {session.rw_m2_total} ({Math.round((session.rw_m2_raw / (session.rw_m2_total || 1)) * 100)}%)
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="opacity-70">Latent Trait (θ̂ EAP)</span>
              <span className="font-mono font-semibold text-blue-400">
                {session.rw_theta > 0 ? `+${session.rw_theta.toFixed(3)}` : session.rw_theta.toFixed(3)}
              </span>
            </div>

            {session.rw_m2_route === 'Easy' && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] leading-relaxed flex items-start gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Module 2 Easy Ceiling Active:</strong> Score capped at ~590 according to official College Board MST psychometric routing.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Math Section */}
        <div
          className={`rounded-2xl border p-6 space-y-4 shadow-md ${
            isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between border-b border-inherit pb-3">
            <div>
              <h3 className="font-bold text-base">Math</h3>
              <p className="text-xs opacity-60">Section 2 (44 Questions)</p>
            </div>
            <div className="text-3xl font-extrabold font-mono text-blue-400">
              {session.math_score}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 1 Raw Score</span>
              <span className="font-mono font-semibold">
                {session.math_m1_raw} / {session.math_m1_total} ({Math.round((session.math_m1_raw / (session.math_m1_total || 1)) * 100)}%)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 2 Routing Gate</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded text-[11px] font-mono ${
                  session.math_m2_route === 'Hard'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                Module 2 ({session.math_m2_route})
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Module 2 Raw Score</span>
              <span className="font-mono font-semibold">
                {session.math_m2_raw} / {session.math_m2_total} ({Math.round((session.math_m2_raw / (session.math_m2_total || 1)) * 100)}%)
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="opacity-70">Latent Trait (θ̂ EAP)</span>
              <span className="font-mono font-semibold text-blue-400">
                {session.math_theta > 0 ? `+${session.math_theta.toFixed(3)}` : session.math_theta.toFixed(3)}
              </span>
            </div>

            {session.math_m2_route === 'Easy' && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] leading-relaxed flex items-start gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Module 2 Easy Ceiling Active:</strong> Score capped at ~590 according to official College Board MST psychometric routing.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
