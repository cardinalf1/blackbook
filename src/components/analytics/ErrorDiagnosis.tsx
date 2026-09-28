import React, { useState } from 'react';
import { SessionRecord, ModuleStage, QuestionRecord } from '../../types/sat';
import { evaluateAnswer } from '../../services/testAssembly';
import { LatexRenderer } from '../common/LatexRenderer';
import { useThemeStore } from '../../stores/themeStore';
import {
  RotateCcw,
  Calculator,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ErrorDiagnosisProps {
  session: SessionRecord;
}

export const ErrorDiagnosis: React.FC<ErrorDiagnosisProps> = ({ session }) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  const [expandedQId, setExpandedQId] = useState<string | null>(null);

  // Compute Second-Guessing Harm Ratio across all 4 modules
  let correctToIncorrectSwaps = 0;
  let incorrectToCorrectSwaps = 0;
  let totalOptionSwaps = 0;

  // Desmos Arbitrage: Math questions missed where desmos was never opened (0 ms)
  const missedDesmosArbitrageItems: { question: QuestionRecord; stage: ModuleStage }[] = [];

  // All missed questions for review
  const allQuestionsWithStatus: {
    question: QuestionRecord;
    stage: ModuleStage;
    userAnswer: string;
    isCorrect: boolean;
    dwellSec: number;
    desmosOpenedSec: number;
    switchChain: string[];
  }[] = [];

  const stages: ModuleStage[] = ['rw_m1', 'rw_m2', 'math_m1', 'math_m2'];

  stages.forEach((stg) => {
    const mod = session.telemetry_blob.modules[stg];
    if (!mod) return;

    mod.questions.forEach((q) => {
      const resp = mod.responses[q.id];
      const telem = mod.telemetry[q.id];
      const chain = telem?.option_switch_chain || [];
      const isCorrect = evaluateAnswer(resp?.answer, q.correct_answer, q.format);
      const dwellSec = Math.round((telem?.dwell_time_ms || 0) / 1000);
      const desmosSec = Math.round((telem?.desmos_opened_duration_ms || 0) / 1000);

      if (chain.length > 1) {
        totalOptionSwaps++;
        const initialAns = chain[0];
        const finalAns = chain[chain.length - 1];
        const initialWasCorrect = evaluateAnswer(initialAns, q.correct_answer, q.format);
        const finalWasCorrect = evaluateAnswer(finalAns, q.correct_answer, q.format);

        if (initialWasCorrect && !finalWasCorrect) {
          correctToIncorrectSwaps++;
        } else if (!initialWasCorrect && finalWasCorrect) {
          incorrectToCorrectSwaps++;
        }
      }

      // Check Desmos Arbitrage
      if (
        stg.startsWith('math') &&
        !isCorrect &&
        q.has_algebra_or_poly &&
        (telem?.desmos_opened_duration_ms || 0) === 0
      ) {
        missedDesmosArbitrageItems.push({ question: q, stage: stg });
      }

      allQuestionsWithStatus.push({
        question: q,
        stage: stg,
        userAnswer: resp?.answer || '(None)',
        isCorrect,
        dwellSec,
        desmosOpenedSec: desmosSec,
        switchChain: chain,
      });
    });
  });

  const netSecondGuessingDelta = incorrectToCorrectSwaps - correctToIncorrectSwaps;

  return (
    <div className="space-y-6">
      {/* Psychometric Behavioral Diagnostics Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Second-Guessing Harm Ratio */}
        <div
          className={`rounded-2xl border p-6 space-y-4 shadow-md ${
            isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Second-Guessing Vector</h3>
              <p className="text-xs opacity-60">Answer swap trajectory analysis</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Total Option Swaps</span>
              <span className="font-mono font-semibold">{totalOptionSwaps} instances</span>
            </div>
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Harm Swaps (Correct &rarr; Incorrect)</span>
              <span className="font-mono font-semibold text-rose-400">
                {correctToIncorrectSwaps}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Benefit Swaps (Incorrect &rarr; Correct)</span>
              <span className="font-mono font-semibold text-emerald-400">
                {incorrectToCorrectSwaps}
              </span>
            </div>

            <div
              className={`p-3 rounded-lg border text-[11px] leading-relaxed ${
                netSecondGuessingDelta < 0
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {netSecondGuessingDelta < 0 ? (
                <span>
                  <strong>Second-Guessing Harm:</strong> You lost {Math.abs(netSecondGuessingDelta)}{' '}
                  raw point(s) by altering your initial instinctual answer to an incorrect choice.
                </span>
              ) : (
                <span>
                  <strong>Constructive Revision:</strong> Your second-guessing yielded a net +
                  {netSecondGuessingDelta} point benefit.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desmos Arbitrage Opportunity Detection */}
        <div
          className={`rounded-2xl border p-6 space-y-4 shadow-md ${
            isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Desmos Arbitrage Shortcuts</h3>
              <p className="text-xs opacity-60">Graphical calculator exploitation flags</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-inherit/40">
              <span className="opacity-70">Unexploited Desmos Questions</span>
              <span className="font-mono font-semibold text-amber-400">
                {missedDesmosArbitrageItems.length} missed
              </span>
            </div>

            <p className="text-xs opacity-75 leading-relaxed">
              Questions tagged with nonlinear systems, polynomial roots, and circle equations can be solved in &lt;15 seconds via regression or direct coordinate plotting on Desmos.
            </p>

            {missedDesmosArbitrageItems.length > 0 ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Identified {missedDesmosArbitrageItems.length} Math questions where manual algebra was attempted and missed without opening Desmos.
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Optimal Desmos utilization observed on algebraic systems.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comprehensive Item-by-Item Review */}
      <div
        className={`rounded-2xl border p-6 shadow-md space-y-4 ${
          isDark ? 'bg-[#121215] border-[#27272A]' : 'bg-white border-gray-200'
        }`}
      >
        <h3 className="text-base font-bold tracking-tight">Full Item Review & Explanations</h3>
        <p className="text-xs opacity-70">
          Click any question to expand detailed answer rationales and KaTeX formulas.
        </p>

        <div className="divide-y divide-inherit">
          {allQuestionsWithStatus.map((item, idx) => {
            const isExpanded = expandedQId === item.question.id;

            return (
              <div key={item.question.id} className="py-3">
                <div
                  onClick={() => setExpandedQId(isExpanded ? null : item.question.id)}
                  className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}

                    <span className="font-mono font-bold text-xs">Item #{idx + 1}</span>

                    <span className="text-xs opacity-60 hidden sm:inline">
                      {item.question.domain} &bull; {item.question.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="opacity-70">
                      Your: <strong>{item.userAnswer}</strong> &bull; Correct: <strong>{item.question.correct_answer}</strong>
                    </span>
                    <span className="opacity-50 hidden md:inline">{item.dwellSec}s dwell</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    className={`mt-4 p-5 rounded-xl border text-xs leading-relaxed space-y-4 animate-in fade-in duration-150 ${
                      isDark ? 'bg-[#0A0A0C] border-zinc-800' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {item.question.stimulus_html && (
                      <div className="p-3 rounded-lg border border-inherit bg-zinc-500/5">
                        <LatexRenderer content={item.question.stimulus_html} />
                      </div>
                    )}

                    <div>
                      <div className="font-semibold text-sm mb-1">Question Prompt:</div>
                      <LatexRenderer content={item.question.stem_html} />
                    </div>

                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      <div className="font-bold mb-1">Official Rationale:</div>
                      <LatexRenderer content={item.question.rationale_html} />
                    </div>

                    {item.switchChain.length > 1 && (
                      <div className="text-[11px] opacity-70 font-mono">
                        Option switch chain: {item.switchChain.join(' &rarr; ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
