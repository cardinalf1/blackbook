import { useRef, useState } from 'react';
import type { HomeScreenProps } from '../../types/home';
import { HOME_GROUPS, SETTINGS_MENU, TEST_CHOOSER, type NavLink } from '../../services/home/routes';
import { SettingsMenu } from './SettingsMenu';
import { TestChooser } from './TestChooser';
import { T } from '../ui/tokens';

export function HomeScreen({
  status,
  upNext,
  poolLine,
  onPrimary,
  onNavigate,
}: HomeScreenProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const groupsRef = useRef<HTMLDivElement>(null);

  const handleScrollToGroups = () => {
    groupsRef.current?.scrollIntoView({ behavior: 'smooth' });
    const firstBtn = groupsRef.current?.querySelector('button');
    firstBtn?.focus();
  };

  const handleLinkClick = (link: NavLink) => {
    if (link.to === 'test_chooser') {
      setChooserOpen(true);
    } else {
      onNavigate(link.to);
    }
  };

  return (
    <div className={`${T.page} flex flex-col p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-5`}>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272A] pb-3">
        <div>
          <h1 className="font-mono text-base font-bold tracking-tight text-white">
            Blackbook
          </h1>
          <p className={T.muted}>
            <span className={T.num}>{status.questions.toLocaleString()}</span> questions on this computer,{' '}
            <span className={T.num}>{status.done.toLocaleString()}</span> done
          </p>
        </div>
        <SettingsMenu items={SETTINGS_MENU} onNavigate={onNavigate} />
      </header>

      {/* Main Content */}
      <div className="space-y-4 sm:space-y-5">
        {/* Up next card */}
        <section className={`${T.card} p-4 sm:p-5 space-y-2.5`}>
          <div className={T.label}>Up next</div>
          <button
            type="button"
            onClick={onPrimary}
            className={`${T.primary} w-full text-base py-3`}
          >
            {upNext.primary.label}
          </button>
          <p className={T.muted}>{upNext.primary.reason}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleScrollToGroups}
              className={T.linkMuted}
            >
              or choose something else
            </button>
            {upNext.moreInProgress > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('in_progress')}
                className={T.linkMuted}
              >
                see all in progress ({upNext.moreInProgress} more)
              </button>
            )}
          </div>
        </section>

        {/* Four group cards */}
        <div
          ref={groupsRef}
          tabIndex={-1}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 focus:outline-none"
        >
          {HOME_GROUPS.map((group) => (
            <section
              key={group.id}
              className={`${T.card} p-3.5 sm:p-4 flex flex-col justify-between`}
            >
              <div>
                <h2 className={T.title}>{group.title}</h2>
                <div className="mt-2.5 flex flex-col gap-2">
                  {group.links.map((link) => (
                    <button
                      key={link.to}
                      type="button"
                      onClick={() => handleLinkClick(link)}
                      className={`text-left rounded-[2px] ${T.focus}`}
                    >
                      <span className={T.link}>{link.label}</span>
                      {link.hint && (
                        <span className={`block ${T.muted} mt-0.5`}>
                          {link.hint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {group.id === 'test' && poolLine && (
                <div className={`${T.muted} mt-3 pt-2 border-t border-[#27272A]`}>
                  {poolLine}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-3 pb-1 text-center border-t border-[#27272A]">
        <p className={T.muted}>
          Independent practice tool. Not affiliated with any testing organization.
        </p>
      </footer>

      {/* Modal Test Chooser */}
      <TestChooser
        open={chooserOpen}
        options={TEST_CHOOSER}
        poolLine={poolLine}
        onChoose={onNavigate}
        onClose={() => setChooserOpen(false)}
      />
    </div>
  );
}
