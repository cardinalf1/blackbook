import type { ChangeEvent } from 'react';
import { nextSprValue, sprPreview } from '../../services/exam/spr';
import type { SprInputProps } from '../../types/exam';

export function SprInput({ value, onChange, questionNumber }: SprInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = nextSprValue(value, e.target.value);
    if (next !== value) {
      onChange(next);
    } else {
      e.target.value = value;
    }
  };

  const preview = sprPreview(value);

  return (
    <div className="space-y-3">
      <div className="w-28 rounded border border-[#27272A] bg-black p-2 flex flex-col items-center">
        <span className="sr-only">Answer for question {questionNumber}</span>
        <input
          id={`spr-input-${questionNumber}`}
          type="text"
          value={value}
          onChange={handleChange}
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Answer for question ${questionNumber}`}
          className="w-full bg-transparent text-center font-mono text-base text-white focus:outline-none"
        />
        <div className="w-full border-b border-zinc-600 mt-1" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 min-h-[1.75rem]">
        <span>Answer Preview:</span>
        {preview.kind === 'plain' && (
          <span className="font-mono text-sm text-white">{preview.text}</span>
        )}
        {preview.kind === 'fraction' && (
          <span
            data-testid="spr-fraction"
            className="inline-flex items-center gap-1 font-mono text-sm text-white"
          >
            {preview.negative && <span data-slot="sign">-</span>}
            <span className="inline-flex flex-col items-center leading-none">
              <span
                data-slot="numerator"
                className="min-w-[1ch] text-center border-b border-current pb-0.5"
              >
                {preview.numerator || '\u00A0'}
              </span>
              <span
                data-slot="denominator"
                className="min-w-[1ch] text-center pt-0.5"
              >
                {preview.denominator || '\u00A0'}
              </span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
