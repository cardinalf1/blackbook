import { CHOICE_LETTERS, type ChoiceLetter } from '../../types/sat';
import { QuestionHtml } from '../QuestionHtml';

export interface ChoiceListProps {
  choices: readonly string[];
  response: string | null;
  onSelect: (letter: string) => void;
  struck: readonly ChoiceLetter[];
  onStrike: (letter: ChoiceLetter) => void;
  eliminatorOn: boolean;
}

export function ChoiceList({
  choices,
  response,
  onSelect,
  struck,
  onStrike,
  eliminatorOn,
}: ChoiceListProps) {
  return (
    <ol className="space-y-2">
      {choices.map((html, i) => {
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
                if (!isStruck && response !== letter) {
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
            {eliminatorOn && (
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
                <span className="line-through">{letter}</span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
