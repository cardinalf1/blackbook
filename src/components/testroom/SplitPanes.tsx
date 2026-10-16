import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useRef } from 'react';
import { SPLIT_MAX_FRACTION, SPLIT_MIN_FRACTION } from '../../config/testRoomConfig';
import type { SplitPanesProps } from '../../types/testRoom';
import { T } from '../ui/tokens';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function SplitPanes({
  left,
  right,
  side,
  leftFraction,
  onResize,
}: SplitPanesProps) {
  const panesContainerRef = useRef<HTMLDivElement>(null);
  const clampedFraction = clamp(leftFraction, SPLIT_MIN_FRACTION, SPLIT_MAX_FRACTION);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = clamp(
        Number((clampedFraction - 0.05).toFixed(4)),
        SPLIT_MIN_FRACTION,
        SPLIT_MAX_FRACTION,
      );
      onResize(next);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = clamp(
        Number((clampedFraction + 0.05).toFixed(4)),
        SPLIT_MIN_FRACTION,
        SPLIT_MAX_FRACTION,
      );
      onResize(next);
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const container = panesContainerRef.current;
    if (!container) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    function onPointerMove(moveEvent: PointerEvent) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const rawFraction = (moveEvent.clientX - rect.left) / rect.width;
      const next = clamp(
        Number(rawFraction.toFixed(4)),
        SPLIT_MIN_FRACTION,
        SPLIT_MAX_FRACTION,
      );
      onResize(next);
    }

    function onPointerUp(upEvent: PointerEvent) {
      try {
        (e.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
      } catch {
        // Pointer capture may have already been released
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  return (
    <div className="flex h-full w-full flex-row overflow-hidden bg-[#0A0A0C] text-white">
      {/* Panes area (left and right) */}
      <div
        ref={panesContainerRef}
        className="relative flex h-full min-w-0 flex-1 flex-row overflow-hidden"
      >
        {left === null ? (
          <div className="flex-1 h-full overflow-y-auto">
            <div className="mx-auto h-full max-w-[48rem] p-6">
              {right}
            </div>
          </div>
        ) : (
          <>
            {/* Left pane */}
            <div
              style={{ width: `${clampedFraction * 100}%` }}
              className="h-full min-w-0 overflow-y-auto p-6"
            >
              {left}
            </div>

            {/* Vertical divider */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={Math.round(clampedFraction * 100)}
              aria-valuemin={Math.round(SPLIT_MIN_FRACTION * 100)}
              aria-valuemax={Math.round(SPLIT_MAX_FRACTION * 100)}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              className={`group relative flex w-3 shrink-0 cursor-col-resize select-none items-center justify-center border-x border-[#27272A] bg-black hover:bg-zinc-900 ${T.focus}`}
            >
              <div className="h-8 w-1 rounded-full bg-zinc-600 transition-colors group-hover:bg-zinc-300 group-focus:bg-white" />
            </div>

            {/* Right pane */}
            <div
              style={{ width: `${(1 - clampedFraction) * 100}%` }}
              className="h-full min-w-0 overflow-y-auto p-6"
            >
              {right}
            </div>
          </>
        )}
      </div>

      {/* Docked side column (Reference sheet, etc.) */}
      {side !== null && (
        <aside className="h-full w-[36rem] max-w-[50%] shrink-0 border-l border-[#27272A] bg-black overflow-y-auto">
          {side}
        </aside>
      )}
    </div>
  );
}
