import type { ChangeEvent } from 'react';
import { nextSprValue } from '../../services/exam/spr';
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

  return (
    <div className="space-y-2">
      <label htmlFor={`spr-input-${questionNumber}`} className="block space-y-1">
        <span className="text-xs font-mono text-zinc-400">
          Answer for question {questionNumber}
        </span>
        <input
          id={`spr-input-${questionNumber}`}
          type="text"
          value={value}
          onChange={handleChange}
          inputMode="decimal"
          autoComplete="off"
          className="block w-40 rounded-md border border-[#27272A] bg-[#0A0A0C] px-3 py-2 font-mono text-sm text-[#FAFAFA] transition-colors focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        />
      </label>
      <div className="font-mono text-xs text-zinc-400">
        Answer preview: {value}
      </div>
      <p className="text-xs text-zinc-500">
        Up to 5 characters, or 6 with a minus sign. Use digits, . / and -.
      </p>
    </div>
  );
}
