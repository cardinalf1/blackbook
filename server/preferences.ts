// Server-side user preferences in `prefs.json` in the user data folder (Step 2).
// Kept outside SQLite so it survives database resets. Keys and fields are strictly allowlisted.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppPreferences, BrowseFilterPreferences, DrillSetupPreferences, ToolPreferences } from '../src/types/preferences';

const SECTIONS = ['rw', 'math'] as const;
const DIFFICULTIES = ['E', 'M', 'H'] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function sanitizePreferences(raw: unknown): AppPreferences {
  if (!isObj(raw)) return {};
  const out: AppPreferences = {};

  if (isObj(raw.drillSetup)) {
    const ds = raw.drillSetup;
    const drill: DrillSetupPreferences = {};
    if (typeof ds.section === 'string' && (SECTIONS as readonly string[]).includes(ds.section)) {
      drill.section = ds.section as DrillSetupPreferences['section'];
    }
    if (typeof ds.domainCode === 'string') drill.domainCode = ds.domainCode.slice(0, 100);
    if (Array.isArray(ds.skillCodes)) {
      drill.skillCodes = ds.skillCodes.filter((s): s is string => typeof s === 'string').slice(0, 50);
    }
    if (Array.isArray(ds.difficulties)) {
      drill.difficulties = ds.difficulties.filter((d): d is 'E' | 'M' | 'H' => (DIFFICULTIES as readonly string[]).includes(d));
    }
    if (typeof ds.countInput === 'string') drill.countInput = ds.countInput.slice(0, 10);
    if (typeof ds.liveOnly === 'boolean') drill.liveOnly = ds.liveOnly;
    if (typeof ds.askConfidence === 'boolean') drill.askConfidence = ds.askConfidence;
    out.drillSetup = drill;
  }

  if (isObj(raw.browseFilters)) {
    const bf = raw.browseFilters;
    const browse: BrowseFilterPreferences = {};
    if (typeof bf.section === 'string' && (['all', ...SECTIONS] as readonly string[]).includes(bf.section)) {
      browse.section = bf.section as BrowseFilterPreferences['section'];
    }
    if (typeof bf.difficulty === 'string' && (['all', ...DIFFICULTIES] as readonly string[]).includes(bf.difficulty)) {
      browse.difficulty = bf.difficulty as BrowseFilterPreferences['difficulty'];
    }
    if (typeof bf.domainCode === 'string') browse.domainCode = bf.domainCode.slice(0, 100);
    if (typeof bf.skillCode === 'string') browse.skillCode = bf.skillCode.slice(0, 100);
    if (typeof bf.query === 'string') browse.query = bf.query.slice(0, 200);
    out.browseFilters = browse;
  }

  if (isObj(raw.toolPreferences)) {
    const tp = raw.toolPreferences;
    const tools: ToolPreferences = {};
    if (typeof tp.lineReaderLines === 'number' && Number.isFinite(tp.lineReaderLines)) {
      tools.lineReaderLines = Math.max(1, Math.min(20, Math.round(tp.lineReaderLines)));
    }
    if (tp.calculatorMode === 'graphing' || tp.calculatorMode === 'scientific') {
      tools.calculatorMode = tp.calculatorMode;
    }
    if (typeof tp.splitFraction === 'number' && Number.isFinite(tp.splitFraction)) {
      tools.splitFraction = Math.max(0.2, Math.min(0.8, tp.splitFraction));
    }
    if (typeof tp.zoomIndex === 'number' && Number.isInteger(tp.zoomIndex)) {
      tools.zoomIndex = Math.max(0, Math.min(10, tp.zoomIndex));
    }
    out.toolPreferences = tools;
  }

  return out;
}

export class PreferencesService {
  private readonly filePath: string;
  private cached: AppPreferences | null = null;

  constructor(dataFolder: string) {
    this.filePath = join(dataFolder, 'prefs.json');
  }

  async get(): Promise<AppPreferences> {
    if (this.cached) return this.cached;
    try {
      const text = await readFile(this.filePath, 'utf8');
      this.cached = sanitizePreferences(JSON.parse(text));
    } catch {
      this.cached = {};
    }
    return this.cached;
  }

  async update(patch: unknown): Promise<AppPreferences> {
    const current = await this.get();
    const cleanPatch = sanitizePreferences(patch);
    const merged: AppPreferences = {
      ...current,
      ...cleanPatch,
      drillSetup: cleanPatch.drillSetup ? { ...current.drillSetup, ...cleanPatch.drillSetup } : current.drillSetup,
      browseFilters: cleanPatch.browseFilters ? { ...current.browseFilters, ...cleanPatch.browseFilters } : current.browseFilters,
      toolPreferences: cleanPatch.toolPreferences ? { ...current.toolPreferences, ...cleanPatch.toolPreferences } : current.toolPreferences,
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(merged, null, 2), 'utf8');
    await rename(tmp, this.filePath);
    this.cached = merged;
    return merged;
  }
}
