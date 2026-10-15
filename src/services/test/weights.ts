import { BAND_WEIGHTS, DIFFICULTY_WEIGHTS } from '../../config/scoringConfig';
import type { Difficulty } from '../../types/sat';

/** Weight of one question: by its scoreBand when valid, else by its difficulty label. */
export function itemWeight(band: number | null | undefined, difficulty: Difficulty): number {
  if (band != null && Number.isInteger(band)) {
    const w = BAND_WEIGHTS[band];
    if (w !== undefined) return w;
  }
  return DIFFICULTY_WEIGHTS[difficulty];
}
