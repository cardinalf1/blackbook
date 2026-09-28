import React from 'react';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Bookmark, CheckCircle2, AlertCircle } from 'lucide-react';

export const BottomDock: React.FC = () => {
  const {
    activeStage,
    modules,
    currentIndex,
    isDrawerOpen,
    setCurrentIndex,
    nextQuestion,
    prevQuestion,
    toggleDrawer,
    submitCurrentModule,
  } = useExamStore();

  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const currentModule = modules[activeStage];
  const totalQuestions = currentModule.questions.length;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalQuestions - 1;

  // Compute answered and flagged statistics for the review panel
  let answeredCount = 0;
  let flaggedCount = 0;
  currentModule.questions.forEach((q) => {
    const resp = currentModule.responses[q.id];
    if (resp?.answer && resp.answer.trim().length > 0) answeredCount++;
    if (resp?.flagged) flaggedCount++;
  });
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <>
      {/* Review Drawer Overlay Matrix */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity"
          onClick={() => toggleDrawer(false)}
        >
          <div
            className={`w-full max-h-[85vh] rounded-t-2xl border-t shadow-2xl p-6 overflow-y-auto ${
              isDark ? 'bg-[#121215] border-[#27272A] text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-inherit mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Review Module Questions</h2>
                  <p className="text-xs opacity-70 mt-1">
                    Click any question number to navigate directly to it before ending this module.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                    <span>Answered ({answeredCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full border inline-block ${isDark ? 'border-zinc-500' : 'border-gray-400'}`} />
                    <span>Unanswered ({unansweredCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-current" />
                    <span>For Review ({flaggedCount})</span>
                  </div>
                </div>
              </div>

              {/* Question Matrix Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-11 gap-2.5 my-6">
                {currentModule.questions.map((q, idx) => {
                  const resp = currentModule.responses[q.id];
                  const hasAnswer = resp?.answer && resp.answer.trim().length > 0;
                  const isFlag = resp?.flagged;
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        toggleDrawer(false);
                      }}
                      className={`relative flex flex-col items-center justify-center h-14 rounded-lg border font-mono text-sm font-semibold transition-all ${
                        isCurrent
                          ? isDark
                            ? 'border-blue-400 ring-2 ring-blue-500/50 bg-blue-950/30 text-white'
                            : 'border-blue-600 ring-2 ring-blue-400 bg-blue-50 text-blue-900'
                          : hasAnswer
                          ? isDark
                            ? 'bg-[#1C1C22] border-blue-500/50 text-blue-400 hover:border-blue-400'
                            : 'bg-blue-50/50 border-blue-300 text-blue-800 hover:border-blue-500'
                          : isDark
                          ? 'bg-[#0A0A0C] border-[#27272A] text-zinc-400 hover:border-zinc-500'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <span>{idx + 1}</span>

                      {/* Flag Indicator */}
                      {isFlag && (
                        <Bookmark className="w-3 h-3 text-amber-500 fill-current absolute top-1 right-1" />
                      )}

                      {/* Status indicator dot */}
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          hasAnswer
                            ? 'bg-blue-500'
                            : isDark
                            ? 'bg-zinc-700'
                            : 'bg-gray-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Drawer Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-inherit">
                <div className="text-xs opacity-75">
                  {unansweredCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      You have {unansweredCount} unanswered questions in this module.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      All {totalQuestions} questions in this module have been answered.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => toggleDrawer(false)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Back to Question
                  </button>

                  <button
                    onClick={() => {
                      if (
                        unansweredCount > 0 &&
                        !confirm(`You have ${unansweredCount} unanswered questions. Are you sure you want to finish this module?`)
                      ) {
                        return;
                      }
                      submitCurrentModule();
                    }}
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md transition-colors"
                  >
                    {activeStage === 'math_m2' ? 'Score Entire Exam' : 'End Module & Proceed'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <footer
        className={`w-full h-16 border-t px-6 flex items-center justify-between select-none transition-colors duration-150 z-30 ${
          isDark
            ? 'bg-[#121215] border-[#27272A] text-[#FAFAFA]'
            : 'bg-white border-[#E5E7EB] text-[#111827]'
        }`}
      >
        {/* Left: Previous Question */}
        <div>
          <button
            onClick={prevQuestion}
            disabled={isFirst}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              isFirst
                ? 'opacity-30 cursor-not-allowed border-transparent'
                : isDark
                ? 'border-[#27272A] hover:bg-[#1C1C21] active:bg-[#25252C]'
                : 'border-[#E5E7EB] hover:bg-gray-100 active:bg-gray-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        {/* Center: Question Drawer Toggle */}
        <div>
          <button
            onClick={() => toggleDrawer()}
            className={`flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-semibold transition-all ${
              isDark
                ? 'border-[#27272A] bg-[#0A0A0C] hover:border-zinc-600 text-zinc-200'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 text-gray-800'
            }`}
            title="Open review question matrix"
          >
            <span>Question {currentIndex + 1} of {totalQuestions}</span>
            {isDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Right: Next or Finish Module */}
        <div>
          <button
            onClick={nextQuestion}
            className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <span>{isLast ? 'Review' : 'Next'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </>
  );
};
