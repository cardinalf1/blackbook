// Home screen contracts (Phase 8). Home is thin: App loads the state and owns every handler.

import type { NavLink, ScreenId } from '../services/home/routes';
import type { UpNextChoice } from '../services/home/upNext';

export interface HomeScreenProps {
  /** "3,695 questions on this computer, 148 done". */
  status: { questions: number; done: number };
  upNext: UpNextChoice;
  /** "Fresh questions for about 6 full tests (estimate)", or null when unknown. Shown small on the Take a test card. */
  poolLine: string | null;
  /** Runs the Up next action. */
  onPrimary: () => void;
  /** Opens any destination (group links, settings menu items, "see all in progress"). */
  onNavigate: (to: ScreenId) => void;
}

export interface SettingsMenuProps {
  items: readonly NavLink[];
  onNavigate: (to: ScreenId) => void;
}

export interface TestChooserProps {
  open: boolean;
  options: readonly NavLink[];
  poolLine: string | null;
  onChoose: (to: ScreenId) => void;
  onClose: () => void;
}

/** The question bank page behind the settings menu: refresh (download) and import from file. */
export interface BankScreenProps {
  questionCount: number;
  /** Called after a refresh or import changed the bank. */
  onBankChanged: () => void;
  onBack: () => void;
}

/** Every rules note in one list, editable. */
export interface RulesNotesScreenProps {
  onBack: () => void;
}
