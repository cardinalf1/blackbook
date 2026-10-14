import { useState } from 'react';
import { isCorrect } from '../services/answers';
import { CHOICE_LETTERS, type ChoiceLetter, type Question } from '../types/sat';
import { QuestionHtml } from './QuestionHtml';

const DIFFICULTY_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' } as const;

interface Props {
  question: Question;
  onAnswered?: (correct: boolean) => void;
}

/**
 * One question: stimulus, stem, four choices or a student-produced response box, and the
 * explanation once answered. Remount with `key={question.id}` to reset between questions.
 */
export function QuestionView({ question, onAnswered }: Props) {
  const [selected, setSelected] = useState<ChoiceLetter | null>(null);
  const [spr, setSpr] = useState('');
  const [checked, setChecked] = useState(false);
  const { answer } = question;

  const response = answer.kind === 'mcq' ? selected : spr.trim();
  const canCheck = !checked && response !== null && response !== '';
  const correct = checked && response !== null && isCorrect(answer, response);

  const check = () => {
    if (!canCheck || response === null) return;
    setChecked(true);
    onAnswered?.(isCorrect(answer, response));
  };

  return (
    <article className="rounded-lg border border-[#27272A] bg-[#121215]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#27272A] px-5 py-3 font-mono text-xs text-zinc-400">
        <span>{question.section === 'rw' ? 'Reading and Writing' : 'Math'}</span>
        <span>{question.domain}</span>
        <span className="text-zinc-300">{question.skill}</span>
        <span>{DIFFICULTY_LABEL[question.difficulty]}</span>
        <span className="ml-auto">#{question.displayId}</span>
      </header>

      <div className={question.stimulusHtml ? 'grid gap-0 md:grid-cols-2' : ''}>
        {question.stimulusHtml && (
          <section className="border-b border-[#27272A] p-5 md:border-b-0 md:border-r">
            <QuestionHtml html={question.stimulusHtml} />
          </section>
        )}

        <section className="space-y-4 p-5">
          <QuestionHtml html={question.stemHtml} />

          {answer.kind === 'mcq' ? (
            <ol className="space-y-2">
              {answer.choices.map((html, i) => {
                const letter = CHOICE_LETTERS[i] as ChoiceLetter;
                const isSel = selected === letter;
                const state = !checked
                  ? isSel
                    ? 'border-zinc-300 bg-zinc-800'
                    : 'border-[#27272A] hover:border-zinc-500'
                  : letter === answer.correct
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : isSel
                      ? 'border-red-500 bg-red-950/40'
                      : 'border-[#27272A] opacity-60';
                return (
                  <li key={letter}>
                    <button
                      type="button"
                      disabled={checked}
                      onClick={() => setSelected(letter)}
                      aria-pressed={isSel}
                      className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left ${state}`}
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-500 font-mono text-xs">
                        {letter}
                      </span>
                      <QuestionHtml html={html} className="min-w-0 flex-1" />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <label className="block space-y-1">
              <span className="text-sm text-zinc-400">Your answer</span>
              <input
                value={spr}
                onChange={(e) => setSpr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && check()}
                disabled={checked}
                maxLength={6}
                inputMode="decimal"
                className="block w-40 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3 py-2 font-mono"
              />
            </label>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={check}
              disabled={!canCheck}
              className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-40"
            >
              Check
            </button>
            {checked && (
              <span className={`text-sm font-medium ${correct ? 'text-emerald-400' : 'text-red-400'}`}>
                {correct ? 'Correct' : 'Incorrect'}
                {!correct && answer.kind === 'spr' && ` (accepted: ${answer.accepted.join(', ')})`}
              </span>
            )}
          </div>

          {checked && (
            <section className="space-y-2 border-t border-[#27272A] pt-4">
              <h3 className="font-mono text-xs uppercase tracking-wide text-zinc-400">Explanation</h3>
              {answer.kind === 'mcq' && answer.keyOrigin === 'rationale' && (
                <p className="text-xs text-amber-400">
                  The answer key for this older question was read from its explanation text.
                </p>
              )}
              <QuestionHtml html={question.rationaleHtml} className="text-sm text-zinc-300" />
            </section>
          )}
        </section>
      </div>
    </article>
  );
}
