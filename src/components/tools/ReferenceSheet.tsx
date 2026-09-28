import React from 'react';
import { useExamStore } from '../../stores/examStore';
import { useThemeStore } from '../../stores/themeStore';
import { X, BookOpen } from 'lucide-react';

export const ReferenceSheet: React.FC = () => {
  const { isReferenceOpen, toggleReference } = useExamStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'stealth';

  if (!isReferenceOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className={`max-w-3xl w-full rounded-2xl border shadow-2xl overflow-hidden my-8 ${
          isDark ? 'bg-[#141418] border-[#2E2E36] text-white' : 'bg-white border-gray-300 text-gray-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b ${
            isDark ? 'border-[#27272A] bg-[#18181E]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold tracking-tight">SAT Math Reference Sheet</h2>
          </div>
          <button
            onClick={toggleReference}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-8 max-h-[75vh] overflow-y-auto">
          {/* 2D Geometric Figures */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">Area & Circumference</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Circle */}
              <div className={`p-4 rounded-xl border flex flex-col items-center text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <svg className="w-16 h-16 stroke-current text-blue-500 mb-2" viewBox="0 0 100 100" fill="none" strokeWidth="3">
                  <circle cx="50" cy="50" r="38" />
                  <line x1="50" y1="50" x2="88" y2="50" strokeDasharray="3 3" />
                  <text x="65" y="44" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">r</text>
                </svg>
                <div className="text-xs font-mono font-semibold space-y-0.5">
                  <p>A = πr²</p>
                  <p>C = 2πr</p>
                </div>
              </div>

              {/* Rectangle */}
              <div className={`p-4 rounded-xl border flex flex-col items-center text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <svg className="w-16 h-16 stroke-current text-blue-500 mb-2" viewBox="0 0 100 100" fill="none" strokeWidth="3">
                  <rect x="15" y="25" width="70" height="50" rx="3" />
                  <text x="48" y="20" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">ℓ</text>
                  <text x="88" y="54" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">w</text>
                </svg>
                <div className="text-xs font-mono font-semibold">
                  <p>A = ℓw</p>
                </div>
              </div>

              {/* Triangle */}
              <div className={`p-4 rounded-xl border flex flex-col items-center text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <svg className="w-16 h-16 stroke-current text-blue-500 mb-2" viewBox="0 0 100 100" fill="none" strokeWidth="3">
                  <polygon points="15,75 85,75 50,20" />
                  <line x1="50" y1="20" x2="50" y2="75" strokeDasharray="3 3" />
                  <text x="48" y="90" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">b</text>
                  <text x="54" y="52" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">h</text>
                </svg>
                <div className="text-xs font-mono font-semibold">
                  <p>A = ½bh</p>
                </div>
              </div>

              {/* Right Triangle */}
              <div className={`p-4 rounded-xl border flex flex-col items-center text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <svg className="w-16 h-16 stroke-current text-blue-500 mb-2" viewBox="0 0 100 100" fill="none" strokeWidth="3">
                  <polygon points="20,80 80,80 20,20" />
                  <rect x="20" y="70" width="10" height="10" />
                  <text x="48" y="95" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">b</text>
                  <text x="8" y="54" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">a</text>
                  <text x="54" y="46" fill="currentColor" stroke="none" fontSize="12" fontFamily="sans-serif">c</text>
                </svg>
                <div className="text-xs font-mono font-semibold">
                  <p>c² = a² + b²</p>
                </div>
              </div>
            </div>
          </div>

          {/* Special Right Triangles */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">Special Right Triangles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 30-60-90 */}
              <div className={`p-5 rounded-xl border flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <h4 className="font-bold text-sm mb-1">30° - 60° - 90° Triangle</h4>
                  <p className="text-xs opacity-75 font-mono">Opposite 30°: x</p>
                  <p className="text-xs opacity-75 font-mono">Opposite 60°: x√3</p>
                  <p className="text-xs opacity-75 font-mono">Hypotenuse: 2x</p>
                </div>
                <div className="text-sm font-mono font-semibold bg-blue-500/10 text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
                  x : x√3 : 2x
                </div>
              </div>

              {/* 45-45-90 */}
              <div className={`p-5 rounded-xl border flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <h4 className="font-bold text-sm mb-1">45° - 45° - 90° Triangle</h4>
                  <p className="text-xs opacity-75 font-mono">Leg: s</p>
                  <p className="text-xs opacity-75 font-mono">Leg: s</p>
                  <p className="text-xs opacity-75 font-mono">Hypotenuse: s√2</p>
                </div>
                <div className="text-sm font-mono font-semibold bg-blue-500/10 text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
                  s : s : s√2
                </div>
              </div>
            </div>
          </div>

          {/* 3D Volumes */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-4">Volume Formulas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs opacity-70 mb-1">Rectangular Prism</p>
                <p className="font-mono font-bold text-sm text-blue-400">V = ℓwh</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs opacity-70 mb-1">Right Cylinder</p>
                <p className="font-mono font-bold text-sm text-blue-400">V = πr²h</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs opacity-70 mb-1">Sphere</p>
                <p className="font-mono font-bold text-sm text-blue-400">V = ⁴⁄₃πr³</p>
              </div>
              <div className={`p-4 rounded-xl border text-center ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs opacity-70 mb-1">Right Cone</p>
                <p className="font-mono font-bold text-sm text-blue-400">V = ⅓πr²h</p>
              </div>
            </div>
          </div>

          {/* Additional Geometric Facts */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-gray-200 bg-gray-100'}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Essential Angle & Radian Facts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              <p>&bull; The number of degrees of arc in a circle is 360.</p>
              <p>&bull; The number of radians of arc in a circle is 2π.</p>
              <p>&bull; The sum of the measures in degrees of the angles of a triangle is 180.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
