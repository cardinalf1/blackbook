import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { LineReaderProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

const LINE_HEIGHT_PX = 28; // 1.75rem = 28px

function clamp(value: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

export function LineReader({ lines, onClose }: LineReaderProps) {
  const windowHeight = lines * LINE_HEIGHT_PX;

  const [top, setTop] = useState(() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const initial = Math.round(vh * 0.4);
    const maxTop = Math.max(0, vh - lines * LINE_HEIGHT_PX);
    return clamp(initial, 0, maxTop);
  });

  const cleanupDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight;
      const maxTop = Math.max(0, vh - windowHeight);
      setTop((prev) => clamp(prev, 0, maxTop));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [windowHeight]);

  useEffect(() => {
    return () => {
      cleanupDragRef.current?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const maxTop = Math.max(0, window.innerHeight - windowHeight);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTop((prev) => clamp(prev + LINE_HEIGHT_PX, 0, maxTop));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTop((prev) => clamp(prev - LINE_HEIGHT_PX, 0, maxTop));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    const startY = e.clientY;
    const startTop = top;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientY - startY;
      const maxTop = Math.max(0, window.innerHeight - windowHeight);
      setTop(clamp(startTop + delta, 0, maxTop));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      cleanupDragRef.current = null;
    };

    cleanupDragRef.current = onPointerUp;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none">
      {/* Darkened area above window */}
      <div
        data-testid="line-reader-above"
        className="fixed inset-x-0 top-0 bg-black/70 pointer-events-none"
        style={{ height: `${top}px` }}
      />

      {/* The clear horizontal window */}
      <div
        data-testid="line-reader-window"
        className="fixed inset-x-0 pointer-events-none border-y border-[#52525B]"
        style={{ top: `${top}px`, height: `${windowHeight}px` }}
      >
        {/* Handle bar on top edge */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Move line reader"
          aria-valuenow={top}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          className={clsx(
            'pointer-events-auto absolute top-0 inset-x-0 flex h-7 items-center justify-between border-b border-[#27272A] bg-black/90 px-3 cursor-ns-resize',
            T.focus,
          )}
        >
          <div className="flex items-center gap-2 text-zinc-400" aria-hidden="true">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="5" r="1" fill="currentColor" />
              <circle cx="9" cy="19" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="5" r="1" fill="currentColor" />
              <circle cx="15" cy="19" r="1" fill="currentColor" />
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Line reader
            </span>
          </div>

          <button
            type="button"
            aria-label="Close line reader"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={clsx(
              'pointer-events-auto rounded p-0.5 text-zinc-400 hover:text-white',
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Darkened area below window */}
      <div
        data-testid="line-reader-below"
        className="fixed inset-x-0 bottom-0 bg-black/70 pointer-events-none"
        style={{ top: `${top + windowHeight}px` }}
      />
    </div>
  );
}
