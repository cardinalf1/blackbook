import React, { useMemo, useState } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { HelpCircle, Check, AlertCircle } from 'lucide-react';

interface SPRInputProps {
  value: string;
  onChange: (val: string) => void;
}

export const SPRInput: React.FC<SPRInputProps> = ({ value, onChange }) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';
  const [showHelp, setShowHelp] = useState(false);

  // Filter and sanitize input on change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Strict 5-character limit
    if (raw.length > 5) {
      raw = raw.slice(0, 5);
    }

    // Allowed characters: [0-9], '.', '/'
    // Reject negative signs and disallowed characters
    let sanitized = '';
    let hasDot = false;
    let hasSlash = false;

    for (let char of raw) {
      if (/[0-9]/.test(char)) {
        sanitized += char;
      } else if (char === '.' && !hasDot && !hasSlash) {
        // Can only have one decimal point, and cannot mix dot with slash in standard SAT grid-in
        sanitized += char;
        hasDot = true;
      } else if (char === '/' && !hasSlash && !hasDot && sanitized.length > 0) {
        // Slash can only appear after numerator digits, and only once
        sanitized += char;
        hasSlash = true;
      }
    }

    onChange(sanitized);
  };

  // Compute live numeric value for fraction preview
  const numericPreview = useMemo(() => {
    if (!value) return null;
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 2 && parts[1]) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          const res = num / den;
          return res.toFixed(4).replace(/\.?0+$/, '');
        }
      }
    }
    return null;
  }, [value]);

  return (
    <div className="w-full max-w-md my-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider opacity-80">
          Student-Produced Response
        </label>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Format Instructions</span>
        </button>
      </div>

      {/* Input Field with 5-Character Mask */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          maxLength={5}
          placeholder="e.g. 7, 3/4, 2.5"
          className={`w-full px-4 py-3.5 rounded-xl border text-xl font-mono tracking-widest transition-all focus:outline-hidden ${
            isDark
              ? 'bg-[#121215] border-[#27272A] text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
          }`}
        />

        {/* Character count counter (X / 5) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono opacity-50 select-none">
          {value.length}/5
        </div>
      </div>

      {/* Decimal equivalent preview if user entered fraction */}
      {numericPreview && (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 font-mono">
          <Check className="w-3.5 h-3.5" />
          <span>Fraction Decimal Equivalent: ≈ {numericPreview}</span>
        </div>
      )}

      {/* Popover Guidelines */}
      {showHelp && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 animate-in fade-in duration-150 ${
            isDark ? 'bg-[#18181C] border-[#3F3F46] text-zinc-300' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold text-amber-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Digital SAT Response Guidelines</span>
          </div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Answers can be up to 5 characters long (including decimal points and fraction lines).</li>
            <li>If an answer is a repeating decimal, enter the most accurate representation possible (e.g., 2/3 or .666 or .667).</li>
            <li>Do not enter mixed numbers; enter them as improper fractions (e.g. 7/2 not 3 1/2) or decimals (3.5).</li>
            <li>Negative values are entered using the minus key if allowed by College Board, or positive values as indicated.</li>
          </ul>
        </div>
      )}
    </div>
  );
};
