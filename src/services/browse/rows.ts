// Browse rows for the whole bank (facets plus derived status). The bank part is read once per
// imported bank (the whole bank is about 35 MB); status is read fresh every time.

import type { BrowseRow } from '../../types/browse';
import type { Question } from '../../types/sat';
import { attemptStore, questionStore } from '../storage';
import { buildRows } from './filter';

let bankCache: { key: string; questions: Question[] } | null = null;

export async function loadRows(): Promise<BrowseRow[]> {
  const meta = await questionStore.getMeta();
  const key = meta ? `${meta.importedAt}:${meta.count}` : 'empty';
  if (bankCache?.key !== key) bankCache = { key, questions: await questionStore.query({}) };
  return buildRows(bankCache.questions, await attemptStore.questionStatus());
}
