import React, { useState, useEffect } from 'react';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { Coffee, Play, CheckCircle2, AlertCircle } from 'lucide-react';

export const SectionBreak: React.FC = () => {
  const { resumeFromBreak, modules } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const [breakSeconds, setBreakSeconds] = useState(10 * 60); // 10 minutes

  useEffect(() => {
    const timer = setInterval(() => {
      setBreakSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(breakSeconds / 60);
  const secs = breakSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const rwM1 = modules.rw_m1.rawScore ?? 0;
  const rwM2 = modules.rw_m2.rawScore ?? 0;

  return (
    <div
      className={`min-h-screen w-full flex flex-col items-center justify-center p-6 select-none transition-colors ${
        isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-[#F9FAFB] text-[#111827]'
      }`}
    >
      <div
        className={`max-w-xl w-full rounded-2xl border p-8 md:p-10 shadow-2xl text-center space-y-6 ${
          isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <Coffee className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Section 1 Complete: 10-Minute Break</h2>
          <p className="text-sm opacity-75">
            You have completed the Reading and Writing section. Take this opportunity to stretch or rest before proceeding to Section 2 (Math).
          </p>
        </div>

        {/* Break Countdown Display */}
        <div
          className={`py-4 px-6 rounded-xl border inline-block ${
            isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <div className="text-xs uppercase tracking-wider opacity-60 mb-1 font-mono">Break Time Remaining</div>
          <div className="text-4xl font-extrabold font-mono text-blue-500 tracking-wider">
            {formatted}
          </div>
        </div>

        <div className="text-xs opacity-60 max-w-sm mx-auto">
          Do not close your device or window. You may resume the Math section at any time.
        </div>

        {/* Resume Button */}
        <div>
          <button
            onClick={resumeFromBreak}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all mx-auto active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Test: Begin Section 2 (Math)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
