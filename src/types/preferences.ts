// Persisted user preferences across app sessions (Step 2). Saved in `prefs.json` in the user data
// folder, outside the database. Keys and shapes are strictly allowlisted.

import type { Difficulty, Section } from './sat';

export interface DrillSetupPreferences {
  section?: Section;
  domainCode?: string | 'all';
  skillCodes?: string[];
  difficulties?: Difficulty[];
  countInput?: string;
  liveOnly?: boolean;
  askConfidence?: boolean;
}

export interface BrowseFilterPreferences {
  section?: Section | 'all';
  difficulty?: Difficulty | 'all';
  domainCode?: string | 'all';
  skillCode?: string | 'all';
  query?: string;
}

export interface ToolPreferences {
  lineReaderLines?: number;
  calculatorMode?: 'graphing' | 'scientific';
  splitFraction?: number;
  zoomIndex?: number;
}

export interface AppPreferences {
  drillSetup?: DrillSetupPreferences;
  browseFilters?: BrowseFilterPreferences;
  toolPreferences?: ToolPreferences;
}

export interface PreferencesStore {
  get(): Promise<AppPreferences>;
  update(patch: Partial<AppPreferences>): Promise<AppPreferences>;
}
