import React, { useEffect, useState } from 'react';
import { runIngestionRoutine } from '../../api/scraper';
import { dbAdapter } from '../../services/db';
import { IngestionProgress, SessionRecord } from '../../types/sat';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import {
  Database,
  Play,
  RotateCw,
  CheckCircle,
  Zap,
  BarChart3,
  Layers,
  History,
  Clock,
  Award,
  ChevronRight,
  ShieldCheck,
  Moon,
  Sun,
} from 'lucide-react';

export const CalibrateScreen: React.FC = () => {
  const { startNewExam, loadPastSession } = useExamStore();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'stealth';

  const [dbCount, setDbCount] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [progress, setProgress] = useState<IngestionProgress>({
    stage: 'idle',
    current: 0,
    total: 0,
    percentage: 0,
    message: 'Awaiting calibration initialization...',
  });
  const [pastSessions, setPastSessions] = useState<SessionRecord[]>([]);

  // Load database metadata and past exam sessions
  const refreshStats = async () => {
    await dbAdapter.init();
    const count = await dbAdapter.getQuestionCount();
    setDbCount(count);
    const sessions = await dbAdapter.getAllSessions();
    setPastSessions(sessions);
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleStartCalibration = async () => {
    setIsCalibrating(true);
    try {
      const count = await runIngestionRoutine((prog) => {
        setProgress(prog);
      });
      setDbCount(count);
      await refreshStats();
    } catch {
      // Handled
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleClearDb = async () => {
    if (confirm('Clear the local IndexedDB database and recalibrate from scratch?')) {
      await dbAdapter.clearAll();
      await refreshStats();
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors duration-150 ${
        isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-[#F9FAFB] text-[#111827]'
      }`}
    >
      {/* Top Navbar */}
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
              Blackbook
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                Adaptive MST
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-colors ${
              isDark
                ? 'border-[#27272A] hover:bg-[#1C1C21] text-amber-400'
                : 'border-gray-200 hover:bg-gray-100 text-slate-700'
            }`}
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12 space-y-8">
        {/* Hero Section */}
        <div className="space-y-3">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Digital SAT Adaptive Testing Engine
          </h2>
          <p className="text-sm md:text-base opacity-75 max-w-3xl leading-relaxed">
            High-fidelity emulation of the College Board Bluebook testing environment featuring authentic 1-2 Multistage Testing (MST) routing, 2PL Item Response Theory scoring, embedded Desmos Graphing Calculator, and KaTeX rendering.
          </p>
        </div>

        {/* Calibration Console Card */}
        <div
          className={`rounded-2xl border p-6 md:p-8 shadow-xl ${
            isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-inherit">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Item Calibration & Persistence</h3>
                <p className="text-xs opacity-70">
                  Direct College Board Educator Question Bank ingestion with MathML-to-KaTeX normalization
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold border flex items-center gap-1.5 ${
                  dbCount > 0
                    ? isDark
                      ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400'
                      : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : isDark
                    ? 'border-amber-500/40 bg-amber-950/20 text-amber-400'
                    : 'border-amber-400 bg-amber-50 text-amber-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${dbCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {dbCount > 0 ? `${dbCount} Items Calibrated` : 'Database Uncalibrated'}
              </span>

              {dbCount > 0 && (
                <button
                  onClick={handleClearDb}
                  disabled={isCalibrating}
                  className="text-xs opacity-50 hover:opacity-100 hover:text-red-400 transition-opacity"
                  title="Purge local IndexedDB storage"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Progress / Status Block */}
          {isCalibrating && (
            <div className="my-6 space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-400 flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  {progress.message}
                </span>
                <span className="font-mono font-bold">{progress.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className="pt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={startNewExam}
              disabled={isCalibrating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Official Adaptive Test</span>
            </button>

            <button
              onClick={handleStartCalibration}
              disabled={isCalibrating}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-semibold transition-all ${
                isDark
                  ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-800'
              }`}
            >
              <RotateCw className={`w-4 h-4 ${isCalibrating ? 'animate-spin' : ''}`} />
              <span>{dbCount > 0 ? 'Sync / Recalibrate Database' : '1-Click Auto Calibrate'}</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            className={`p-5 rounded-2xl border ${
              isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="p-2.5 w-fit rounded-lg bg-indigo-500/10 text-indigo-400 mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1">Authentic 1-2 MST Routing</h4>
            <p className="text-xs opacity-75 leading-relaxed">
              Standard 66.7% (18/27) RW and 63.6% (14/22) Math Module 1 routing threshold gates with dynamic difficulty progression.
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border ${
              isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="p-2.5 w-fit rounded-lg bg-purple-500/10 text-purple-400 mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1">2PL IRT Psychometrics</h4>
            <p className="text-xs opacity-75 leading-relaxed">
              Bayesian Expected A Posteriori (EAP) ability estimation with the official ~590 Easy Module 2 score ceiling.
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border ${
              isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="p-2.5 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1">Offline-First IndexedDB Tier</h4>
            <p className="text-xs opacity-75 leading-relaxed">
              Decoupled behind a StorageAdapter mirroring SQLite schemas, ready for desktop Electron deployment.
            </p>
          </div>
        </div>

        {/* Previous Test History */}
        {pastSessions.length > 0 && (
          <div
            className={`rounded-2xl border p-6 shadow-md ${
              isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-base">Completed Exam History</h3>
            </div>

            <div className="divide-y divide-inherit">
              {pastSessions.slice(0, 5).map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => loadPastSession(session)}
                  className="py-3.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 font-bold font-mono text-sm">
                      {session.composite_score}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">
                        RW: {session.rw_score} &bull; Math: {session.math_score}
                      </p>
                      <p className="text-[11px] opacity-60">
                        {new Date(session.timestamp).toLocaleDateString()} at{' '}
                        {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; Routes: RW {session.rw_m2_route}, Math {session.math_m2_route}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-blue-500 font-medium">
                    <span>View Analytics</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
