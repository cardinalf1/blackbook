import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { HighlightStyle, HighlightToolbarProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

const SWATCHES: readonly {
  style: HighlightStyle;
  label: string;
  color: string;
}[] = [
  { style: 'yellow', label: 'Yellow highlight', color: 'rgba(250, 204, 21, 0.6)' },
  { style: 'blue', label: 'Blue highlight', color: 'rgba(56, 189, 248, 0.6)' },
  { style: 'pink', label: 'Pink highlight', color: 'rgba(244, 114, 182, 0.6)' },
];

export function HighlightToolbar({
  anchor,
  current,
  onStyle,
  onDelete,
  onNote,
  onClose,
}: HighlightToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [placeBelow, setPlaceBelow] = useState(anchor.y < 50);

  useLayoutEffect(() => {
    if (toolbarRef.current) {
      const height = toolbarRef.current.offsetHeight || 44;
      setPlaceBelow(anchor.y - height - 8 < 0);
    } else {
      setPlaceBelow(anchor.y < 50);
    }
  }, [anchor.y]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Highlight"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      style={{
        left: `${anchor.x}px`,
        top: placeBelow ? `${anchor.y + 8}px` : `${anchor.y - 8}px`,
        transform: placeBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
      }}
      className="fixed z-50 flex items-center gap-1.5 rounded-[2px] border border-[#27272A] bg-black p-1.5 shadow-xl select-none"
    >
      {SWATCHES.map((swatch) => {
        const isCurrent = current === swatch.style;
        return (
          <button
            key={swatch.style}
            type="button"
            aria-label={swatch.label}
            aria-pressed={isCurrent}
            onClick={() => onStyle(swatch.style)}
            className={clsx(
              'h-6 w-6 rounded-full border border-black/20 transition-transform hover:scale-105',
              T.focus,
              isCurrent && 'ring-2 ring-white ring-offset-2 ring-offset-black',
            )}
            style={{ backgroundColor: swatch.color }}
          />
        );
      })}

      <button
        type="button"
        aria-label="Underline"
        aria-pressed={current === 'underline'}
        onClick={() => onStyle('underline')}
        className={clsx(
          'flex h-6 w-6 items-center justify-center rounded-[2px] text-white hover:bg-zinc-800 transition-colors',
          T.focus,
          current === 'underline' && 'ring-2 ring-white ring-offset-2 ring-offset-black bg-zinc-800',
        )}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 4v6a6 6 0 0 0 12 0V4" />
          <line x1="4" y1="20" x2="20" y2="20" />
        </svg>
      </button>

      {onDelete && (
        <button
          type="button"
          aria-label="Delete highlight"
          onClick={onDelete}
          className={clsx(
            'flex h-6 w-6 items-center justify-center rounded-[2px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors',
            T.focus,
          )}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}

      <button
        type="button"
        aria-label="Add or edit note"
        onClick={onNote}
        className={clsx(
          'flex h-6 w-6 items-center justify-center rounded-[2px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors',
          T.focus,
        )}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      </button>
    </div>
  );
}
