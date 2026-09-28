import React from 'react';
import { useExamStore } from './stores/examStore';
import { useThemeStore } from './stores/themeStore';
import { useExamTimer } from './hooks/useExamTimer';
import { useTelemetry } from './hooks/useTelemetry';
import { ExamHeader } from './components/layout/ExamHeader';
import { BottomDock } from './components/layout/BottomDock';
import { ReadingSplitPane } from './components/exam/ReadingSplitPane';
import { MathPane } from './components/exam/MathPane';
import { SectionBreak } from './components/exam/SectionBreak';
import { DesmosModal } from './components/tools/DesmosModal';
import { ReferenceSheet } from './components/tools/ReferenceSheet';
import { CalibrateScreen } from './components/setup/CalibrateScreen';
import { AnalyticsScreen } from './components/analytics/AnalyticsScreen';

export default function App() {
  const { status, activeStage, modules, currentIndex, completedSession } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  // Mount active countdown timer and behavioral micro-telemetry tracking
  useExamTimer();
  useTelemetry();

  // Screen 1: Calibration / Dashboard Screen
  if (status === 'idle' || status === 'calibrating') {
    return <CalibrateScreen />;
  }

  // Screen 2: 10-Minute Break between Section 1 (RW) and Section 2 (Math)
  if (status === 'break') {
    return <SectionBreak />;
  }

  // Screen 3: Post-Exam Psychometric Analytics Report
  if (status === 'results' && completedSession) {
    return <AnalyticsScreen session={completedSession} />;
  }

  // Screen 4: Active Bluebook Testing Client Emulation
  const currentModule = modules[activeStage];
  const currentQ = currentModule.questions[currentIndex];
  const currentResp = currentQ
    ? currentModule.responses[currentQ.id] || { answer: '', eliminatedChoices: [], flagged: false }
    : { answer: '', eliminatedChoices: [], flagged: false };

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-between overflow-hidden select-none transition-colors duration-150 ${
        isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-[#FFFFFF] text-[#111827]'
      }`}
    >
      {/* Official Bluebook Exam Header */}
      <ExamHeader />

      {/* Main Testing Viewport */}
      <main className="flex-1 w-full flex flex-col overflow-hidden relative">
        {currentQ ? (
          currentQ.section === 'reading_writing' ? (
            <ReadingSplitPane
              key={currentQ.id}
              question={currentQ}
              response={currentResp}
              questionNumber={currentIndex + 1}
            />
          ) : (
            <MathPane
              key={currentQ.id}
              question={currentQ}
              response={currentResp}
              questionNumber={currentIndex + 1}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-sm opacity-60">
            Loading next test module...
          </div>
        )}
      </main>

      {/* Official Bluebook Bottom Navigation Dock & Matrix Drawer */}
      <BottomDock />

      {/* Embedded Tooling Modals (Math Section) */}
      {activeStage.startsWith('math') && (
        <>
          <DesmosModal />
          <ReferenceSheet />
        </>
      )}
    </div>
  );
}
