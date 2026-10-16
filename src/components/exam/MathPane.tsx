import type { ExamQuestionPaneProps } from '../../types/exam';
import { QuestionHtml } from '../QuestionHtml';
import { ChoiceList } from './ChoiceList';
import { SprInput } from './SprInput';

function QuestionHeader({
  number,
  flagged,
  onToggleFlag,
}: {
  number: number;
  flagged: boolean;
  onToggleFlag: () => void;
}) {
  return (
    <header className="flex items-center justify-between pb-4">
      <span className="flex h-7 min-w-7 items-center justify-center rounded border border-[#27272A] bg-[#121215] px-2 font-mono text-sm font-semibold text-zinc-100">
        {number}
      </span>
      <button
        type="button"
        onClick={onToggleFlag}
        aria-pressed={flagged}
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
          flagged
            ? 'border-amber-500 bg-amber-950/40 text-amber-300'
            : 'border-[#27272A] bg-[#121215] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
        }`}
      >
        {flagged ? 'Marked for review' : 'Mark for review'}
      </button>
    </header>
  );
}

export function MathPane({
  question,
  number,
  response,
  onSelect,
  struck,
  onStrike,
  flagged,
  onToggleFlag,
}: ExamQuestionPaneProps) {
  const hasStimulus = question.stimulusHtml !== null && question.stimulusHtml !== '';

  return (
    <div className="h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <QuestionHeader
          number={number}
          flagged={flagged}
          onToggleFlag={onToggleFlag}
        />

        {hasStimulus && <QuestionHtml html={question.stimulusHtml!} />}

        <QuestionHtml html={question.stemHtml} />

        {question.answer.kind === 'spr' ? (
          <SprInput
            value={response ?? ''}
            onChange={onSelect}
            questionNumber={number}
          />
        ) : (
          <ChoiceList
            choices={question.answer.choices}
            response={response}
            onSelect={onSelect}
            struck={struck}
            onStrike={onStrike}
            eliminatorOn={true}
          />
        )}
      </div>
    </div>
  );
}
