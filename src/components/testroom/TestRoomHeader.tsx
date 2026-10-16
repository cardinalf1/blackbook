import { useEffect } from 'react';
import type { HeaderTool, MoreItemId, MoreMenuItem, TestRoomHeaderProps } from '../../types/testRoom';
import { formatCountdown } from '../../utils/formatCountdown';
import { T } from '../ui/tokens';

function ToolIcon({ id }: { id: HeaderTool['id'] }) {
  if (id === 'calculator') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
        <line x1="4.5" y1="4.5" x2="11.5" y2="4.5" />
        <circle cx="5.5" cy="8" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="8" cy="8" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="8" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="5.5" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === 'reference') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M3 2.5h10v11H3z" />
        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 2l4 4-7 7H3v-4l7-7z" />
    </svg>
  );
}

function MoreItemIcon({ id }: { id: MoreItemId }) {
  switch (id) {
    case 'help':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M6.5 6.5a1.5 1.5 0 013 0c0 1-1.5 1.25-1.5 2.25M8 11.5h.01" />
        </svg>
      );
    case 'shortcuts':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M4 6h1M7 6h1M10 6h2M4 9h2M7 9h5" />
        </svg>
      );
    case 'lineReader':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <line x1="2" y1="4" x2="14" y2="4" strokeDasharray="2 2" />
          <rect x="2" y="7" width="12" height="3" fill="currentColor" stroke="none" />
          <line x1="2" y1="13" x2="14" y2="13" strokeDasharray="2 2" />
        </svg>
      );
    case 'unscheduledBreak':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <path d="M6 5.5v5M10 5.5v5" />
        </svg>
      );
    case 'pause':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="4" y="3" width="3" height="10" rx="0.5" fill="currentColor" stroke="none" />
          <rect x="9" y="3" width="3" height="10" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'exit':
      return (
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M6 3H3v10h3M10 5l3 3-3 3M6 8h7" />
        </svg>
      );
    default:
      return null;
  }
}

export function TestRoomHeader({
  sectionTitle,
  directionsOpen,
  onToggleDirections,
  remainingMs,
  timerHidden,
  onToggleTimer,
  paused,
  tools,
  moreOpen,
  onToggleMore,
  moreItems,
  zoomPercent,
}: TestRoomHeaderProps) {
  useEffect(() => {
    if (!moreOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onToggleMore();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moreOpen, onToggleMore]);

  const isWarning = !paused && !timerHidden && remainingMs <= 300000;

  return (
    <header className="relative flex h-16 w-full items-center justify-between border-b border-[#27272A] bg-black px-6 text-white select-none">
      {/* Zoom indicator top-right corner */}
      <div className="absolute top-1 right-2 font-mono text-[10px] text-zinc-500 pointer-events-none">
        {zoomPercent}%
      </div>

      {/* Left zone: section title & directions toggle */}
      <div className="flex flex-col items-start justify-center">
        <h1 className="font-mono text-sm font-semibold text-white leading-tight">
          {sectionTitle}
        </h1>
        <button
          type="button"
          onClick={onToggleDirections}
          aria-expanded={directionsOpen}
          aria-label={directionsOpen ? 'Hide directions' : 'Show directions'}
          className={`mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-400 hover:text-white ${T.focus}`}
        >
          <span>Directions</span>
          <svg
            className={`h-3 w-3 transition-transform ${directionsOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>

      {/* Center zone: countdown / paused / clock icon & hide/show button */}
      <div className="flex flex-col items-center justify-center">
        {paused ? (
          <div className="font-mono text-base font-bold text-zinc-300">
            Paused
          </div>
        ) : timerHidden ? (
          <div className="flex h-6 items-center justify-center">
            <svg
              data-testid="timer-clock-icon"
              className="h-4 w-4 text-zinc-300"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5l2 1" />
            </svg>
          </div>
        ) : (
          <div
            className={`font-mono text-base font-bold tabular-nums ${
              isWarning ? 'text-amber-400' : 'text-white'
            }`}
          >
            {formatCountdown(remainingMs)}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleTimer}
          aria-label={timerHidden ? 'Show timer' : 'Hide timer'}
          className={`mt-0.5 font-mono text-[11px] text-zinc-400 hover:text-white ${T.focus}`}
        >
          {timerHidden ? 'Show' : 'Hide'}
        </button>
      </div>

      {/* Right zone: tools and more dropdown */}
      <div className="flex items-center gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={tool.onClick}
            aria-pressed={tool.active}
            className={`flex flex-col items-center justify-center px-2 py-0.5 text-zinc-400 hover:text-white transition-colors ${
              tool.active ? 'text-white' : ''
            } ${T.focus}`}
          >
            <ToolIcon id={tool.id} />
            <span
              className={`font-mono text-[10px] ${
                tool.active ? 'border-b-2 border-white pb-0.5 font-semibold text-white' : ''
              }`}
            >
              {tool.label}
            </span>
          </button>
        ))}

        {/* More button */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label="More options"
            className={`flex flex-col items-center justify-center p-1.5 rounded-[2px] text-zinc-400 hover:text-white ${
              moreOpen ? 'text-white bg-zinc-900' : ''
            } ${T.focus}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
              aria-hidden="true"
            >
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {/* More Dropdown Menu */}
          {moreOpen && (
            <div
              role="menu"
              aria-label="More options"
              className="absolute right-0 top-full mt-2 w-56 rounded-[2px] border border-[#27272A] bg-black p-1 shadow-2xl z-50"
            >
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    item.onSelect();
                  }}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-[2px] px-3 py-2 text-left font-mono text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white ${T.focus}`}
                >
                  <div className="flex items-center gap-2.5">
                    <MoreItemIcon id={item.id} />
                    <span>{item.label}</span>
                  </div>
                  {item.active && (
                    <span className="font-mono text-[10px] font-semibold text-zinc-400">
                      On
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
