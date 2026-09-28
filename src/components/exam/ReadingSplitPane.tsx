import React from 'react';
import { QuestionRecord, QuestionUserResponse } from '../../types/sat';
import { LatexRenderer } from '../common/LatexRenderer';
import { OptionEliminator } from './OptionEliminator';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';

interface ReadingSplitPaneProps {
  question: QuestionRecord;
  response: QuestionUserResponse;
  questionNumber: number;
}

export const ReadingSplitPane: React.FC<ReadingSplitPaneProps> = ({
  question,
  response,
  questionNumber,
}) => {
  const { selectOption, toggleEliminateOption } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  return (
    <div className="flex-1 w-full h-[calc(100vh-7.5rem)] flex flex-col md:flex-row overflow-hidden">
      {/* Left Pane (50%): Passage Context (Independently Scrollable) */}
      <div
        className={`w-full md:w-1/2 h-full overflow-y-auto p-6 md:p-8 border-b md:border-b-0 md:border-r transition-colors ${
          isDark
            ? 'border-[#27272A] bg-[#0A0A0C] text-[#FAFAFA]'
            : 'border-[#E5E7EB] bg-[#FAFAFA] text-[#111827]'
        }`}
      >
        <div className="max-w-xl mx-auto pb-12">
          {question.stimulus_html ? (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed">
              <LatexRenderer content={question.stimulus_html} />
            </div>
          ) : (
            <p className="text-sm opacity-50 italic">No passage text for this item.</p>
          )}
        </div>
      </div>

      {/* Right Pane (50%): Stem & Options (Independently Scrollable) */}
      <div
        className={`w-full md:w-1/2 h-full overflow-y-auto p-6 md:p-8 transition-colors ${
          isDark ? 'bg-[#0A0A0C] text-[#FAFAFA]' : 'bg-white text-[#111827]'
        }`}
      >
        <div className="max-w-xl mx-auto pb-16 space-y-6">
          {/* Question Number Badge */}
          <div className="flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${
                isDark
                  ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  : 'border-gray-300 bg-gray-100 text-gray-700'
              }`}
            >
              Question {questionNumber}
            </span>
            <span className="text-xs opacity-50">
              {question.domain} &bull; {question.skill}
            </span>
          </div>

          {/* Stem */}
          <div className="text-base md:text-lg font-medium leading-relaxed">
            <LatexRenderer content={question.stem_html} />
          </div>

          {/* Options with (x) Eliminator */}
          <div className="pt-2">
            <OptionEliminator
              choices={question.choices}
              selectedKey={response.answer}
              eliminatedKeys={response.eliminatedChoices}
              onSelectOption={selectOption}
              onToggleEliminate={toggleEliminateOption}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
