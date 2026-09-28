import React, { useState } from 'react';
import { SessionRecord } from '../../types/sat';
import { ScoreSummary } from './ScoreSummary';
import { PacingTimeline } from './PacingTimeline';
import { ErrorDiagnosis } from './ErrorDiagnosis';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { RotateCcw, Award, Clock, Activity, Home, Sun, Moon } from 'lucide-react';

interface AnalyticsScreenProps {
  session: SessionRecord;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ session }) => {
  const { setStatus, startNewExam } = useExamStore();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'stealth';

  const [activeTab, setActiveTab] = useState<'summary' | 'pacing' | 'diagnosis'>('summary');

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors duration-150 ${
        isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-[#F9FAFB] text-[#111827]'
      }`}
    >
      {/* Top Header */}
      <header
        className={`w-full h-16 border-b px-6 md:px-12 flex items-center justify-between ${
          isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-[#E5E7EB]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            B
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight flex items-center gap-2">
              Blackbook Psychometrics
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Exam Evaluated
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatus('idle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isDark ? 'border-[#27272A] hover:bg-[#1C1C21]' : 'border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={startNewExam}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Test</span>
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors ${
              isDark ? 'border-[#27272A] hover:bg-[#1C1C21] text-amber-400' : 'border-gray-200 hover:bg-gray-100'
            }`}
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div
        className={`w-full border-b px-6 md:px-12 flex items-center gap-4 ${
          isDark ? 'bg-[#121215]/50 border-[#27272A]' : 'bg-white border-[#E5E7EB]'
        }`}
      >
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 py-3.5 border-b-2 text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'summary'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Score Summary & Routing</span>
        </button>

        <button
          onClick={() => setActiveTab('pacing')}
          className={`flex items-center gap-2 py-3.5 border-b-2 text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'pacing'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pacing & Dwell Timeline</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnosis')}
          className={`flex items-center gap-2 py-3.5 border-b-2 text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'diagnosis'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent opacity-60 hover:opacity-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Error Diagnosis & Explanations</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12">
        {activeTab === 'summary' && <ScoreSummary session={session} />}
        {activeTab === 'pacing' && <PacingTimeline session={session} />}
        {activeTab === 'diagnosis' && <ErrorDiagnosis session={session} />}
      </main>
    </div>
  );
};
