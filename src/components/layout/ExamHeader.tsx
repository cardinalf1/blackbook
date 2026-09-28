import React from 'react';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { Calculator, BookOpen, Bookmark, Eye, EyeOff, Moon, Sun, AlertTriangle } from 'lucide-react';

export const ExamHeader: React.FC = () => {
  const {
    activeStage,
    modules,
    currentIndex,
    isTimerHidden,
    fiveMinWarningTriggered,
    showFiveMinModal,
    dismissFiveMinModal,
    toggleTimerVisibility,
    toggleDesmos,
    toggleReference,
    toggleFlag,
    isDesmosOpen,
    isReferenceOpen,
  } = useExamStore();

  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'stealth';

  const currentModule = modules[activeStage];
  const currentQ = currentModule.questions[currentIndex];
  const userResp = currentQ ? currentModule.responses[currentQ.id] : undefined;
  const isFlagged = userResp?.flagged ?? false;

  const isMath = activeStage.startsWith('math');
  const stageTitles: Record<string, string> = {
    rw_m1: 'Section 1: Reading and Writing — Module 1',
    rw_m2: 'Section 1: Reading and Writing — Module 2',
    math_m1: 'Section 2: Math — Module 1',
    math_m2: 'Section 2: Math — Module 2',
  };

  const timeRemaining = currentModule.timeRemainingSec;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUnderFiveMinutes = timeRemaining <= 300;

  return (
    <>
      <header
        className={`w-full h-14 border-b px-4 flex items-center justify-between select-none transition-colors duration-150 ${
          isDark
            ? 'bg-[#121215] border-[#27272A] text-[#FAFAFA]'
            : 'bg-white border-[#E5E7EB] text-[#111827]'
        }`}
      >
        {/* Left: Section and Module Title */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-sm md:text-base font-semibold tracking-tight">
              {stageTitles[activeStage] || 'Digital SAT Exam'}
            </h1>
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span>Directions</span>
            </div>
          </div>
        </div>

        {/* Center: Countdown Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded border text-sm font-mono transition-colors ${
              isUnderFiveMinutes
                ? isDark
                  ? 'border-red-500/50 bg-red-950/20 text-red-400 font-semibold animate-pulse'
                  : 'border-red-400 bg-red-50 text-red-600 font-semibold animate-pulse'
                : isDark
                ? 'border-[#27272A] bg-[#0A0A0C] text-[#FAFAFA]'
                : 'border-[#E5E7EB] bg-gray-50 text-[#111827]'
            }`}
          >
            {isTimerHidden ? (
              <span className="text-xs font-sans tracking-wide px-1 py-0.5 opacity-60">Timer Hidden</span>
            ) : (
              <span className="text-base font-bold tabular-nums tracking-wider">{formattedTime}</span>
            )}

            <button
              onClick={toggleTimerVisibility}
              disabled={fiveMinWarningTriggered}
              title={
                fiveMinWarningTriggered
                  ? 'Timer cannot be hidden with less than 5 minutes remaining'
                  : isTimerHidden
                  ? 'Show countdown timer'
                  : 'Hide countdown timer'
              }
              className={`p-1 rounded hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {isTimerHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Right: Tools & Controls */}
        <div className="flex items-center gap-2">
          {/* Math Tools */}
          {isMath && (
            <>
              <button
                onClick={toggleDesmos}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  isDesmosOpen
                    ? isDark
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-blue-100 border-blue-600 text-blue-700'
                    : isDark
                    ? 'border-[#27272A] hover:bg-[#1C1C21] text-[#FAFAFA]'
                    : 'border-[#E5E7EB] hover:bg-gray-100 text-[#111827]'
                }`}
                title="Open Desmos Graphing Calculator"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Calculator</span>
              </button>

              <button
                onClick={toggleReference}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  isReferenceOpen
                    ? isDark
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-blue-100 border-blue-600 text-blue-700'
                    : isDark
                    ? 'border-[#27272A] hover:bg-[#1C1C21] text-[#FAFAFA]'
                    : 'border-[#E5E7EB] hover:bg-gray-100 text-[#111827]'
                }`}
                title="View SAT Reference Sheet Formulas"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Reference</span>
              </button>
            </>
          )}

          {/* Mark for Review Flag */}
          <button
            onClick={toggleFlag}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              isFlagged
                ? isDark
                  ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                  : 'bg-amber-100 border-amber-500 text-amber-800'
                : isDark
                ? 'border-[#27272A] hover:bg-[#1C1C21] text-[#FAFAFA]'
                : 'border-[#E5E7EB] hover:bg-gray-100 text-[#111827]'
            }`}
            title="Mark this question for later review"
          >
            <Bookmark className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">Mark for Review</span>
          </button>

          {/* Theme Switcher (Stealth vs Raw) */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded border transition-colors ${
              isDark
                ? 'border-[#27272A] hover:bg-[#1C1C21] text-amber-400'
                : 'border-[#E5E7EB] hover:bg-gray-100 text-slate-700'
            }`}
            title={isDark ? 'Switch to Bluebook Raw (Light)' : 'Switch to Blackbook Stealth (Dark)'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Official 5-Minute Involuntary Notification Modal */}
      {showFiveMinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`max-w-md w-full rounded-xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
              isDark ? 'bg-[#18181C] border-[#3F3F46] text-white' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold">5 Minutes Remaining</h2>
            </div>
            <p className="text-sm opacity-90 leading-relaxed mb-6">
              You have 5 minutes left in this module. The countdown timer will remain visible on your screen for the duration of the test.
            </p>
            <div className="flex justify-end">
              <button
                onClick={dismissFiveMinModal}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
