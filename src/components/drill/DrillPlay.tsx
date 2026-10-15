import { CHOICE_LETTERS, type ChoiceLetter } from '../../types/sat';
import type { Confidence, DrillPlayProps } from '../../types/session';
import { QuestionHtml } from '../QuestionHtml';

const DIFFICULTY_LABEL = { E: 'Easy', M: 'Medium', H: 'Hard' } as const;

const CONFIDENCE_LEVELS: readonly { value: Confidence; label: string }[] = [
  { value: 'guess', label: 'Guess' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'sure', label: 'Sure' },
];

export function DrillPlay({
  question,
  index,
  total,
  response,
  onSelect,
  struck,
  onStrike,
  flagged,
  onToggleFlag,
  askConfidence,
  confidence,
  onRate,
  onBack,
  onNext,
  saving,
  saveError,
  onRetry,
  onExit,
}: DrillPlayProps) {
  const { answer } = question;
  const navDisabled = saving || saveError !== null;
  const isLast = index === total - 1;
  const nextLabel = saving ? 'Saving...' : isLast ? 'Finish' : 'Next';
  const showConfidence = askConfidence && response !== null && response !== '';

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={onExit}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Save and exit
        </button>
        <span className="font-mono text-xs text-zinc-400">
          Question {index + 1} of {total}
        </span>
      </nav>

      {/* Save error banner */}
      {saveError !== null && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-red-900/50 bg-[#121215] p-4 text-sm text-red-400"
          role="alert"
        >
          <span className="min-w-0 flex-1">{saveError}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Retry
          </button>
        </div>
      )}

      {/* Question card */}
      <article className="rounded-lg border border-[#27272A] bg-[#121215]">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#27272A] px-5 py-3 font-mono text-xs text-zinc-400">
          <span>{question.section === 'rw' ? 'Reading and Writing' : 'Math'}</span>
          <span>{question.domain}</span>
          <span className="text-zinc-300">{question.skill}</span>
          <span>{DIFFICULTY_LABEL[question.difficulty]}</span>
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            className={`rounded border px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              flagged
                ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                : 'border-[#27272A] hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            {flagged ? 'Flagged' : 'Flag for review'}
          </button>
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
                  const isSel = response === letter;
                  const isStruck = struck.includes(letter);
                  const state = isStruck
                    ? 'border-zinc-800/80 bg-[#0A0A0C]/50 text-zinc-500'
                    : isSel
                      ? 'border-zinc-300 bg-zinc-800 text-zinc-100'
                      : 'border-[#27272A] text-zinc-200 hover:border-zinc-500';

                  return (
                    <li key={letter} className="flex items-start gap-2">
                      <button
                        type="button"
                        disabled={isStruck}
                        onClick={() => {
                          if (response !== letter) {
                            onSelect(letter);
                          }
                        }}
                        aria-pressed={isSel}
                        className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${state} ${
                          isStruck ? 'cursor-not-allowed opacity-40' : ''
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors ${
                            isStruck
                              ? 'border-zinc-700 text-zinc-600'
                              : isSel
                                ? 'border-zinc-200 text-zinc-100'
                                : 'border-zinc-500 text-zinc-300'
                          }`}
                        >
                          {letter}
                        </span>
                        <QuestionHtml
                          html={html}
                          className={`min-w-0 flex-1 ${isStruck ? 'line-through text-zinc-500' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStrike(letter)}
                        aria-pressed={isStruck}
                        aria-label={isStruck ? `Restore choice ${letter}` : `Strike out choice ${letter}`}
                        className={`mt-1 flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                          isStruck
                            ? 'border-zinc-500 bg-zinc-800 text-zinc-100 shadow-inner'
                            : 'border-[#27272A] bg-[#0A0A0C] text-zinc-400 hover:border-zinc-500 hover:text-zinc-100'
                        }`}
                      >
                        {isStruck ? '\u21ba' : 'x'}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <label className="block space-y-1">
                <span className="text-sm text-zinc-400">Your answer</span>
                <input
                  type="text"
                  value={response ?? ''}
                  onChange={(e) => onSelect(e.target.value)}
                  maxLength={6}
                  inputMode="decimal"
                  className="block w-40 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3 py-2 font-mono text-sm text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                />
              </label>
            )}

            {/* Confidence rating */}
            {showConfidence && (
              <div className="space-y-1.5 border-t border-[#27272A]/60 pt-3">
                <span className="block text-xs text-zinc-400">How sure are you?</span>
                <div className="flex items-center gap-2">
                  {CONFIDENCE_LEVELS.map((opt) => {
                    const isRated = confidence === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={isRated}
                        onClick={() => onRate(opt.value)}
                        className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                          isRated
                            ? 'border-zinc-300 bg-zinc-800 text-zinc-100'
                            : 'border-[#27272A] bg-[#0A0A0C] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </article>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          disabled={index === 0 || navDisabled}
          onClick={onBack}
          className="rounded-md border border-[#27272A] px-4 py-1.5 font-mono text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Back
        </button>
        <button
          type="button"
          disabled={navDisabled}
          onClick={onNext}
          className="rounded-md bg-zinc-100 px-4 py-1.5 font-mono text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {nextLabel}
        </button>
      </footer>
    </div>
  );
}
