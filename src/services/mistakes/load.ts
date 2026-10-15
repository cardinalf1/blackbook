// Loads what the mistake screens show from the stores. UI calls these and renders the result.

import type { BrowseRow } from '../../types/browse';
import type { MistakeItem, MistakeLogRow, MistakeReason, MistakeTag } from '../../types/mistakes';
import type { SessionMode, SessionReport, SessionSource } from '../../types/session';
import { loadRows } from '../browse/rows';
import { attemptStore, mistakeStore } from '../storage';
import { telemetry } from '../telemetry';
import { buildMistakeItems, buildMistakeLog, skillMedians } from './mistakes';
import { saveMistakeTag } from './tagging';

/** The misses of a finished session, each with its tag or a suggestion. */
export async function loadMistakeItems(report: SessionReport, source: SessionSource): Promise<MistakeItem[]> {
  const [rows, attempts, tags] = await Promise.all([loadRows(), attemptStore.listAttempts(), mistakeStore.listTags()]);
  const skills = new Map(rows.map((r): [string, string] => [r.id, r.skillCode]));
  const skillOf = (id: string) => skills.get(id);
  return buildMistakeItems(report, source, tags, skillMedians(attempts, skillOf), skillOf);
}

/** Every tagged miss, newest first. */
export async function loadMistakeLog(): Promise<{ rows: MistakeLogRow[]; browse: Map<string, BrowseRow> }> {
  const [browse, tags] = await Promise.all([loadRows(), mistakeStore.listTags()]);
  const byId = new Map(browse.map((r): [string, BrowseRow] => [r.id, r]));
  return { rows: buildMistakeLog(tags, byId), browse: byId };
}

/** Saves one tag (appends a row, logs the event). Returns the stored tag. */
export function tagMistake(input: {
  sessionId: string;
  questionId: string;
  mode: SessionMode;
  reason: MistakeReason;
  note: string;
  suggested: boolean;
  previous: MistakeTag | null;
}): Promise<MistakeTag> {
  return saveMistakeTag(input, { store: mistakeStore, telemetry });
}
