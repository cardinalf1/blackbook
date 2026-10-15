import { useEffect } from 'react';
import type { ReferenceSheetProps } from '../../types/exam';

const FORMULAS: readonly string[] = [
  'Area of a circle: A = \u03c0r\u00b2; circumference: C = 2\u03c0r',
  'Area of a rectangle: A = \u2113w',
  'Area of a triangle: A = \u00bdbh',
  'Pythagorean theorem: c\u00b2 = a\u00b2 + b\u00b2',
  'Special right triangles: 30\u00b0-60\u00b0-90\u00b0 sides x, x\u221a3, 2x; 45\u00b0-45\u00b0-90\u00b0 sides s, s, s\u221a2',
  'Volume of a rectangular prism: V = \u2113wh',
  'Volume of a cylinder: V = \u03c0r\u00b2h',
  'Volume of a sphere: V = (4/3)\u03c0r\u00b3',
  'Volume of a cone: V = (1/3)\u03c0r\u00b2h',
  'Volume of a pyramid: V = (1/3)\u2113wh',
  'The number of degrees of arc in a circle is 360.',
  'The number of radians of arc in a circle is 2\u03c0.',
  'The sum of the measures in degrees of the angles of a triangle is 180.',
];

export function ReferenceSheet({ onClose }: ReferenceSheetProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-title"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-lg border border-[#27272A] bg-[#121215] text-[#FAFAFA] shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-[#27272A] px-5 py-4">
          <h2 id="reference-title" className="text-base font-semibold text-zinc-100">
            Reference
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reference"
            className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <span aria-hidden="true" className="text-lg leading-none">&times;</span>
          </button>
        </header>
        <div className="overflow-y-auto p-5 font-mono text-sm leading-relaxed text-zinc-300">
          <ul className="list-disc space-y-2.5 pl-5">
            {FORMULAS.map((formula) => (
              <li key={formula}>{formula}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
