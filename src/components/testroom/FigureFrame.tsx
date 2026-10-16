import { useEffect, useState } from 'react';
import type { FigureFrameProps } from '../../types/testRoom';
import { FIGURE_ZOOM_LEVELS } from '../../config/testRoomConfig';
import { QuestionHtml } from '../QuestionHtml';
import { T } from '../ui/tokens';

export function FigureFrame({ html, onZoom }: FigureFrameProps) {
  const defaultIndex = FIGURE_ZOOM_LEVELS.indexOf(100) >= 0 ? FIGURE_ZOOM_LEVELS.indexOf(100) : 2;
  const [zoomIndex, setZoomIndex] = useState(defaultIndex);
  const [fullScreen, setFullScreen] = useState(false);

  const percent = FIGURE_ZOOM_LEVELS[zoomIndex] ?? 100;
  const scale = percent / 100;
  const isMin = zoomIndex <= 0;
  const isMax = zoomIndex >= FIGURE_ZOOM_LEVELS.length - 1;

  const handleZoomIn = () => {
    if (!isMax) {
      const nextIndex = zoomIndex + 1;
      const nextLevel = FIGURE_ZOOM_LEVELS[nextIndex];
      if (nextLevel !== undefined) {
        setZoomIndex(nextIndex);
        onZoom?.(nextLevel);
      }
    }
  };

  const handleZoomOut = () => {
    if (!isMin) {
      const prevIndex = zoomIndex - 1;
      const prevLevel = FIGURE_ZOOM_LEVELS[prevIndex];
      if (prevLevel !== undefined) {
        setZoomIndex(prevIndex);
        onZoom?.(prevLevel);
      }
    }
  };

  const handleReset = () => {
    const resetLevel = FIGURE_ZOOM_LEVELS[defaultIndex] ?? 100;
    setZoomIndex(defaultIndex);
    onZoom?.(resetLevel);
  };

  useEffect(() => {
    if (!fullScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreen]);

  const renderZoomControls = () => (
    <div className="flex items-center gap-2">
      {/* Zoom in */}
      <button
        type="button"
        aria-label="Zoom in"
        onClick={handleZoomIn}
        disabled={isMax}
        className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white disabled:opacity-40 ${T.focus}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
          <line x1="7" y1="4.5" x2="7" y2="9.5" />
          <line x1="4.5" y1="7" x2="9.5" y2="7" />
        </svg>
      </button>

      {/* Zoom out */}
      <button
        type="button"
        aria-label="Zoom out"
        onClick={handleZoomOut}
        disabled={isMin}
        className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white disabled:opacity-40 ${T.focus}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
          <line x1="4.5" y1="7" x2="9.5" y2="7" />
        </svg>
      </button>

      {/* Percentage */}
      <span className="min-w-[42px] text-center font-mono text-xs tabular-nums text-zinc-300">
        {percent}%
      </span>

      {/* Reset */}
      <button
        type="button"
        aria-label="Reset zoom"
        onClick={handleReset}
        className={`rounded-[2px] border border-[#27272A] bg-black px-2 py-1 font-mono text-xs text-zinc-300 hover:border-zinc-500 hover:text-white ${T.focus}`}
      >
        Reset
      </button>
    </div>
  );

  return (
    <div data-bb-figure-frame="" className="flex flex-col rounded-[2px] border border-[#27272A] bg-black text-white">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-[#27272A] bg-[#121215] px-3 py-2">
        {renderZoomControls()}
        <button
          type="button"
          aria-label="Full screen"
          onClick={() => setFullScreen(true)}
          className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white ${T.focus}`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v-4h-4" />
          </svg>
        </button>
      </div>

      {/* Content box */}
      <div className="w-full overflow-auto p-4">
        <div
          style={{ zoom: scale }}
        >
          <QuestionHtml html={html} />
        </div>
      </div>

      {/* Full screen modal */}
      {fullScreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 sm:p-8"
          onClick={() => setFullScreen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Figure, full screen"
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-1 flex-col overflow-hidden rounded-[2px] border border-[#27272A] bg-[#121215] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#27272A] bg-black px-4 py-2.5">
              {renderZoomControls()}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFullScreen(false)}
                className={`rounded-[2px] p-1.5 text-zinc-400 hover:text-white ${T.focus}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div
                style={{ zoom: scale }}
              >
                <QuestionHtml html={html} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
