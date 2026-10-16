import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { CALCULATOR_MIN_SIZE } from '../../config/testRoomConfig';
import type {
  CalculatorHandle,
  CalculatorMode,
  CalculatorPanelProps,
  PanelRect,
} from '../../types/testRoom';
import { T } from '../ui/tokens';

function clamp(val: number, min: number, max: number): number {
  if (min > max) return min;
  return Math.max(min, Math.min(max, val));
}

function getViewportBounds(rectWidth: number, rectHeight: number) {
  const vw = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 768;
  return {
    maxX: Math.max(0, vw - rectWidth),
    maxY: Math.max(0, vh - rectHeight),
  };
}

export function CalculatorPanel({
  mode,
  onModeChange,
  rect,
  onRectChange,
  onClose,
  engine,
  engineState,
  onEngineStateChange,
}: CalculatorPanelProps) {
  const [mountError, setMountError] = useState(false);
  const divRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CalculatorHandle | null>(null);

  const rectRef = useRef<PanelRect>(rect);
  rectRef.current = rect;

  const onRectChangeRef = useRef(onRectChange);
  onRectChangeRef.current = onRectChange;

  const onEngineStateChangeRef = useRef(onEngineStateChange);
  onEngineStateChangeRef.current = onEngineStateChange;

  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;

  // Mount engine when engine or mode changes
  useEffect(() => {
    if (!engine) {
      setMountError(false);
      return;
    }
    const container = divRef.current;
    if (!container) return;

    let cancelled = false;
    setMountError(false);

    engine
      .mount(container, mode, engineStateRef.current)
      .then((handle) => {
        if (cancelled) {
          try {
            onEngineStateChangeRef.current(mode, handle.getState());
          } finally {
            handle.destroy();
          }
          return;
        }
        handleRef.current = handle;
      })
      .catch(() => {
        if (!cancelled) {
          setMountError(true);
        }
      });

    return () => {
      cancelled = true;
      const handle = handleRef.current;
      if (handle) {
        try {
          onEngineStateChangeRef.current(mode, handle.getState());
        } finally {
          handle.destroy();
        }
        handleRef.current = null;
      }
    };
  }, [engine, mode]);

  // Handle panel resizing
  const prevSize = useRef({ width: rect.width, height: rect.height });
  useEffect(() => {
    if (
      prevSize.current.width !== rect.width ||
      prevSize.current.height !== rect.height
    ) {
      prevSize.current = { width: rect.width, height: rect.height };
      handleRef.current?.resize();
    }
  }, [rect.width, rect.height]);

  // Move drag handlers
  const handleMovePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialRect = rectRef.current;

    const onPointerMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const { maxX, maxY } = getViewportBounds(initialRect.width, initialRect.height);
      const newX = clamp(initialRect.x + dx, 0, maxX);
      const newY = clamp(initialRect.y + dy, 0, maxY);
      onRectChangeRef.current({
        ...initialRect,
        x: newX,
        y: newY,
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleMoveKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowRight') dx = 16;
    else if (e.key === 'ArrowLeft') dx = -16;
    else if (e.key === 'ArrowDown') dy = 16;
    else if (e.key === 'ArrowUp') dy = -16;
    else return;

    e.preventDefault();
    const current = rectRef.current;
    const { maxX, maxY } = getViewportBounds(current.width, current.height);
    const newX = clamp(current.x + dx, 0, maxX);
    const newY = clamp(current.y + dy, 0, maxY);
    onRectChangeRef.current({
      ...current,
      x: newX,
      y: newY,
    });
  };

  // Resize drag handlers
  const handleResizePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialRect = rectRef.current;

    const onPointerMove = (ev: globalThis.PointerEvent) => {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      const newWidth = Math.max(CALCULATOR_MIN_SIZE.width, initialRect.width + dw);
      const newHeight = Math.max(CALCULATOR_MIN_SIZE.height, initialRect.height + dh);
      onRectChangeRef.current({
        ...initialRect,
        width: newWidth,
        height: newHeight,
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleResizeKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    let dw = 0;
    let dh = 0;
    if (e.key === 'ArrowRight') dw = 16;
    else if (e.key === 'ArrowLeft') dw = -16;
    else if (e.key === 'ArrowDown') dh = 16;
    else if (e.key === 'ArrowUp') dh = -16;
    else return;

    e.preventDefault();
    const current = rectRef.current;
    const newWidth = Math.max(CALCULATOR_MIN_SIZE.width, current.width + dw);
    const newHeight = Math.max(CALCULATOR_MIN_SIZE.height, current.height + dh);
    onRectChangeRef.current({
      ...current,
      width: newWidth,
      height: newHeight,
    });
  };

  return (
    <div
      role="region"
      aria-label="Calculator"
      className="fixed z-40 flex flex-col rounded-[2px] border border-[#27272A] bg-[#0A0A0C] text-[#FAFAFA] shadow-2xl overflow-hidden"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-[#27272A] bg-black px-2 select-none">
        {/* Segmented switch */}
        <div className="inline-flex rounded-[2px] border border-[#27272A] bg-black p-0.5" role="group" aria-label="Calculator mode">
          <button
            type="button"
            aria-pressed={mode === 'graphing'}
            onClick={() => onModeChange('graphing')}
            className={`${T.segment} rounded-[2px] px-2.5 py-1 text-xs ${
              mode === 'graphing' ? T.segmentOn : T.segmentOff
            } ${T.focus}`}
          >
            Graphing
          </button>
          <button
            type="button"
            aria-pressed={mode === 'scientific'}
            onClick={() => onModeChange('scientific')}
            className={`${T.segment} rounded-[2px] px-2.5 py-1 text-xs ${
              mode === 'scientific' ? T.segmentOn : T.segmentOff
            } ${T.focus}`}
          >
            Scientific
          </button>
        </div>

        {/* Drag handle */}
        <button
          type="button"
          aria-label="Move calculator"
          onPointerDown={handleMovePointerDown}
          onKeyDown={handleMoveKeyDown}
          className={`flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:text-white cursor-grab active:cursor-grabbing ${T.focus}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </button>

        {/* Close X */}
        <button
          type="button"
          aria-label="Close calculator"
          onClick={onClose}
          className={`flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:text-white ${T.focus}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {engine === null ? (
          <div className="flex h-full flex-col justify-center p-4 text-xs font-mono text-zinc-400 space-y-2">
            <p>No calculator is set up. To use the Desmos calculator, add your own Desmos API key in Settings (settings menu on Home, then Settings, "Desmos calculator").</p>
            <p>Until then, use your own calculator. Nothing else in the test changes.</p>
          </div>
        ) : (
          <>
            <div
              ref={divRef}
              className={mountError ? 'hidden' : 'h-full w-full'}
            />
            {mountError && (
              <div className="flex h-full flex-col justify-center p-4 text-xs font-mono text-zinc-400">
                <p>The calculator could not load (offline or blocked). Everything else keeps working.</p>
              </div>
            )}
          </>
        )}

        {/* Resize handle */}
        <button
          type="button"
          aria-label="Resize calculator"
          onPointerDown={handleResizePointerDown}
          onKeyDown={handleResizeKeyDown}
          className={`absolute bottom-0 right-0 p-1 text-zinc-500 hover:text-white cursor-nwse-resize ${T.focus}`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 1L1 9M9 5L5 9M9 9L8 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
