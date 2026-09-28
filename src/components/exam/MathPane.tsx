import React from 'react';
import { QuestionRecord, QuestionUserResponse } from '../../types/sat';
import { LatexRenderer } from '../common/LatexRenderer';
import { OptionEliminator } from './OptionEliminator';
import { SPRInput } from './SPRInput';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';

interface MathPaneProps {
  question: QuestionRecord;
  response: QuestionUserResponse;
  questionNumber: number;
}

export const MathPane: React.FC<MathPaneProps> = ({
  question,
  response,
  questionNumber,
}) => {
  const { selectOption, toggleEliminateOption, setSprAnswer } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  return (
    <div
      className={`flex-1 w-full h-[calc(100vh-7.5rem)] overflow-y-auto p-6 md:p-10 transition-colors ${
        isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-white text-[#111827]'
      }`}
    >
      <div className="max-w-3xl mx-auto pb-16 space-y-6">
        {/* Question Header Info */}
        <div className="flex items-center justify-between border-b border-inherit pb-3">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded text-xs font-mono font-bold border ${
                isDark
                  ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  : 'border-gray-300 bg-gray-100 text-gray-700'
              }`}
            >
              Question {questionNumber}
            </span>
            <span className="text-xs uppercase tracking-wider font-semibold opacity-60">
              {question.format === 'spr' ? 'Student-Produced Response' : 'Multiple Choice'}
            </span>
          </div>

          <span className="text-xs opacity-50">
            {question.domain} &bull; {question.skill}
          </span>
        </div>

        {/* Optional Stimulus/Figure */}
        {question.stimulus_html && (
          <div className="p-4 rounded-xl border border-inherit bg-zinc-500/5">
            <LatexRenderer content={question.stimulus_html} />
          </div>
        )}

        {/* Math Question Stem */}
        <div className="text-base md:text-lg font-medium leading-relaxed">
          <LatexRenderer content={question.stem_html} />
        </div>

        {/* Answer Selection: MCQ or SPR */}
        <div className="pt-4">
          {question.format === 'mcq' ? (
            <OptionEliminator
              choices={question.choices}
              selectedKey={response.answer}
              eliminatedKeys={response.eliminatedChoices}
              onSelectOption={selectOption}
              onToggleEliminate={toggleEliminateOption}
            />
          ) : (
            <SPRInput
              value={response.answer}
              onChange={setSprAnswer}
            />
          )}
        </div>
      </div>
    </div>
  );
};
