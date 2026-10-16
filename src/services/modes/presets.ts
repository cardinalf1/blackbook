// Math 800 and English 800: presets on the drill setup, not new engines. Practice modes only; they
// promise nothing about a real score. "Hard" uses the bank's difficulty label H, which in this bank
// is exactly scoreBand 6 and 7 (checked over the live set on 2026-10-16; docs/ai-spec.md).
// Pure.

import { PACE_TARGET_MS } from '../../config/paceConfig';
import type { DrillConfig, PresetId } from '../../types/drill';
import type { MistakeReason, MistakeTag } from '../../types/mistakes';
import type { SessionRecord, StoredAttempt } from '../../types/session';
import { latestTags } from '../mistakes/mistakes';

export interface PresetSpec {
  id: PresetId;
  title: string;
  /** Plain description, including that it is practice only. */
  blurb: string;
  base: Omit<DrillConfig, 'count'>;
  defaultCount: number;
  /** Time per question for the set's soft time limit; null for untimed. */
  secondsPerQuestion: number | null;
}

export const PRESETS: Record<PresetId, PresetSpec> = {
  math800: {
    id: 'math800',
    title: 'Math 800',
    blurb: 'Hard Math questions only, at the real pace. A practice mode, not a promise about your score.',
    base: { section: 'math', domainCode: 'all', skillCodes: [], difficulties: ['H'], liveOnly: true, preset: 'math800' },
    defaultCount: 15,
    secondsPerQuestion: PACE_TARGET_MS.math / 1000,
  },
  english800: {
    id: 'english800',
    title: 'English 800: hard set',
    blurb: 'Hard Reading and Writing questions across all domains, at the real pace. A practice mode, not a promise about your score.',
    base: { section: 'rw', domainCode: 'all', skillCodes: [], difficulties: ['H'], liveOnly: true, preset: 'english800' },
    defaultCount: 15,
    secondsPerQuestion: PACE_TARGET_MS.rw / 1000,
  },
  conventions: {
    id: 'conventions',
    title: 'English 800: Conventions clean sets',
    blurb: 'Standard English Conventions at every difficulty. These rules are learnable, so aim for sets with zero misses.',
    base: { section: 'rw', domainCode: 'SEC', skillCodes: [], difficulties: [], liveOnly: true, preset: 'conventions' },
    defaultCount: 10,
    secondsPerQuestion: PACE_TARGET_MS.rw / 1000,
  },
};

export function presetConfig(id: PresetId, count: number = PRESETS[id].defaultCount): DrillConfig {
  const p = PRESETS[id];
  const n = Math.max(1, Math.round(count));
  return { ...p.base, count: n, timeLimitMs: p.secondsPerQuestion === null ? undefined : Math.round(p.secondsPerQuestion * 1000 * n) };
}

/** Time left on a preset set's soft limit, from the active time so far. Null when untimed. Never below zero. */
export function presetTimeLeftMs(config: DrillConfig, activeMs: number): number | null {
  return config.timeLimitMs === undefined ? null : Math.max(0, config.timeLimitMs - activeMs);
}

export interface CleanSetStats {
  preset: PresetId;
  sets: number;
  cleanSets: number;
  /** Clean sets in a row, counting back from the latest. */
  cleanStreak: number;
  bestStreak: number;
  /** Average misses (wrong or blank) per set. */
  slipsPerSet: number;
  /** Misses by the tag in force; untagged misses are counted apart. */
  slipsByReason: Partial<Record<MistakeReason, number>>;
  untagged: number;
}

/** Clean-set figures for one preset from finished sessions. A clean set is a finished set with zero misses. */
export function cleanSetStats(
  preset: PresetId,
  sessions: readonly SessionRecord[],
  attempts: readonly StoredAttempt[],
  tags: readonly MistakeTag[],
): CleanSetStats {
  const sets = sessions
    .filter((s) => s.status === 'finished' && s.config.preset === preset)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  const correct = new Set(attempts.filter((a) => a.status === 'final' && a.response !== '' && a.correct).map((a) => a.id));
  const inForce = latestTags(tags);
  const slipsByReason: Partial<Record<MistakeReason, number>> = {};
  let untagged = 0;
  let total = 0;
  let clean = 0;
  let run = 0;
  let best = 0;
  for (const s of sets) {
    const misses = s.queueIds.filter((q) => !correct.has(`${s.id}:${q}`));
    total += misses.length;
    for (const q of misses) {
      const t = inForce.get(`${s.id}:${q}`);
      if (t) slipsByReason[t.reason] = (slipsByReason[t.reason] ?? 0) + 1;
      else untagged++;
    }
    if (misses.length === 0) {
      clean++;
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return { preset, sets: sets.length, cleanSets: clean, cleanStreak: run, bestStreak: best, slipsPerSet: sets.length > 0 ? total / sets.length : 0, slipsByReason, untagged };
}
