import React from 'react';
import { ChoiceItem } from '../../types/sat';
import { LatexRenderer } from '../common/LatexRenderer';
import { useThemeStore } from '../../stores/themeStore';

interface OptionEliminatorProps {
  choices: ChoiceItem[];
  selectedKey: string;
  eliminatedKeys: string[];
  onSelectOption: (key: string) => void;
  onToggleEliminate: (key: string) => void;
}

export const OptionEliminator: React.FC<OptionEliminatorProps> = ({
  choices,
  selectedKey,
  eliminatedKeys,
  onSelectOption,
  onToggleEliminate,
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  return (
    <div className="space-y-3 w-full">
      {choices.map((choice) => {
        const isSelected = selectedKey === choice.key;
        const isEliminated = eliminatedKeys.includes(choice.key);

        return (
          <div
            key={choice.key}
            className={`group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
              isEliminated
                ? 'opacity-30 border-transparent bg-transparent cursor-not-allowed'
                : isSelected
                ? isDark
                  ? 'border-blue-500 bg-blue-950/25 ring-1 ring-blue-500 text-white'
                  : 'border-slate-800 bg-slate-900 text-white shadow-sm'
                : isDark
                ? 'border-[#27272A] bg-[#121215] hover:border-zinc-500 text-[#FAFAFA]'
                : 'border-gray-300 bg-white hover:border-blue-500 text-[#111827]'
            }`}
          >
            {/* Clickable Choice Hitbox */}
            <div
              onClick={() => {
                if (!isEliminated) {
                  onSelectOption(choice.key);
                }
              }}
              className="flex-1 flex items-start gap-3.5 cursor-pointer"
            >
              {/* Radio Indicator */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border transition-all mt-0.5 ${
                  isSelected
                    ? isDark
                      ? 'border-blue-400 bg-blue-500 text-white'
                      : 'border-white bg-white text-slate-950 shadow-inner'
                    : isDark
                    ? 'border-zinc-600 bg-zinc-800/80 text-zinc-300 group-hover:border-zinc-400'
                    : 'border-gray-400 bg-gray-100 text-gray-700 group-hover:border-blue-500 group-hover:text-blue-600'
                }`}
              >
                {choice.key}
              </div>

              {/* Choice Content */}
              <div className="flex-1 pt-0.5 text-sm md:text-base leading-relaxed">
                <div className={isEliminated ? 'line-through text-zinc-500' : ''}>
                  <LatexRenderer content={choice.text} isInline />
                </div>
              </div>
            </div>

            {/* (x) Strikethrough / Eliminator Toggle Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEliminate(choice.key);
              }}
              className={`px-2 py-1 rounded text-xs font-mono font-bold tracking-tight border transition-all shrink-0 ${
                isEliminated
                  ? isDark
                    ? 'bg-rose-950/60 border-rose-500/70 text-rose-300 hover:bg-rose-900/80'
                    : 'bg-rose-100 border-rose-400 text-rose-700 hover:bg-rose-200'
                  : isDark
                  ? 'border-zinc-700 text-zinc-400 hover:border-rose-400/80 hover:text-rose-400 hover:bg-zinc-800'
                  : 'border-gray-300 text-gray-500 hover:border-rose-400 hover:text-rose-600 hover:bg-gray-100'
              }`}
              title={isEliminated ? 'Restore choice' : 'Eliminate choice'}
            >
              {isEliminated ? 'RESTORE' : '(x)'}
            </button>
          </div>
        );
      })}
    </div>
  );
};
