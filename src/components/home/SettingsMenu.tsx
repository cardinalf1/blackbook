import { useEffect, useRef, useState } from 'react';
import type { SettingsMenuProps } from '../../types/home';
import { T } from '../ui/tokens';

export function SettingsMenu({ items, onNavigate }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
        onClick={() => setOpen((prev) => !prev)}
        className={`${T.secondary} text-xs py-1.5 px-3`}
      >
        Settings
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Settings menu"
          className={`absolute right-0 top-full mt-1.5 z-50 w-64 ${T.card} p-1.5 flex flex-col gap-1`}
        >
          {items.map((item) => (
            <button
              key={item.to}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate(item.to);
              }}
              className={`w-full text-left p-2 rounded-[2px] hover:bg-zinc-900 transition-colors ${T.focus} flex flex-col gap-0.5`}
            >
              <span className={T.body}>{item.label}</span>
              {item.hint && <span className={T.muted}>{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
