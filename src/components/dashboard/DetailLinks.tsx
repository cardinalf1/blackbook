import clsx from 'clsx';
import type { DetailLinksProps } from '../../types/dashboard';
import { T } from '../ui/tokens';

export function DetailLinks({ links, onOpen }: DetailLinksProps) {
  return (
    <section className={clsx(T.card, T.cardPad, 'space-y-4')} aria-label="Detailed views">
      <div className="flex items-baseline justify-between gap-2 border-b border-[#27272A] pb-2">
        <h2 className={T.title}>Detailed views</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <button
            key={link.to}
            type="button"
            onClick={() => onOpen(link.to)}
            className={clsx(
              'flex flex-col justify-start rounded-[2px] border border-[#27272A] bg-black p-3.5 text-left transition-colors hover:border-zinc-500',
              T.focus,
            )}
          >
            <span className={clsx(T.title, 'text-zinc-200')}>{link.label}</span>
            {link.hint && <span className={clsx(T.muted, 'mt-1.5 font-mono')}>{link.hint}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
