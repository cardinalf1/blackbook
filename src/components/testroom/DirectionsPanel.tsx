import type { DirectionsPanelProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

export function DirectionsPanel({ section, onClose }: DirectionsPanelProps) {
  return (
    <div
      role="region"
      aria-label="Directions"
      className={`${T.card} relative z-40 mx-auto w-full max-w-3xl p-6 shadow-2xl`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
        <h2 className={T.title}>
          {section === 'rw' ? 'Reading and Writing Directions' : 'Math Directions'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close directions"
          className={`rounded-[2px] p-1 text-zinc-400 hover:text-white ${T.focus}`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      </div>

      <div className="py-4 space-y-3 text-sm text-zinc-300 leading-relaxed">
        {section === 'rw' ? (
          <>
            <p>
              This section consists of two timed modules featuring multiple-choice questions based on short passages.
              Each question has one best answer.
            </p>
            <p>
              You can move back and forth within the active module, mark questions for review, and use the question menu to jump between items.
            </p>
          </>
        ) : (
          <>
            <p>
              This section consists of two timed modules. Most questions are multiple choice, while some ask you to type an answer into a response box.
            </p>
            <p>
              A calculator and a formula reference sheet are available on every question in this section.
            </p>
            <p>
              Unless a question indicates otherwise, figures are drawn to scale, lie in a plane, and all variables represent real numbers.
            </p>
          </>
        )}
      </div>

      <div className="flex justify-end pt-3 border-t border-[#27272A]">
        <button
          type="button"
          onClick={onClose}
          className={T.secondary}
        >
          Close
        </button>
      </div>
    </div>
  );
}
