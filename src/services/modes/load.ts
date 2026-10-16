// Loaders for the Phase 7 screens. UI calls these and renders the result.

import { drillStore } from '../../stores/drillStore';
import type { PresetId } from '../../types/drill';
import type { WeakDrillResult } from '../../types/ai';
import { loadFacets } from '../drill/facetCache';
import { attemptStore, mistakeStore, questionStore } from '../storage';
import { cleanSetStats, presetConfig, type CleanSetStats } from './presets';

export async function loadCleanSetStats(preset: PresetId): Promise<CleanSetStats> {
  const [sessions, attempts, tags] = await Promise.all([attemptStore.listSessions({ status: 'finished' }), attemptStore.listAttempts(), mistakeStore.listTags()]);
  return cleanSetStats(preset, sessions, attempts, tags);
}

/** Starts a preset drill with the usual selection (unseen first, then misses). */
export async function startPreset(preset: PresetId, count?: number): Promise<void> {
  const facets = await loadFacets(questionStore);
  await drillStore.getState().start(presetConfig(preset, count), facets);
}

/** Starts the drill a weak-skill pick produced, in its order. */
export async function startWeakDrill(result: WeakDrillResult): Promise<void> {
  const facets = await loadFacets(questionStore);
  await drillStore.getState().startWeakSkill(result.questionIds, facets);
}
