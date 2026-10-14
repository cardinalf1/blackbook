import type { QuestionFacet } from '../../types/drill';
import type { QuestionStore } from '../storage/types';
import { toFacet } from './facets';

let cache: { key: string; facets: QuestionFacet[] } | null = null;

/**
 * Content-free view of the whole bank for counting and statistics. Reading every question is
 * expensive, so the result is kept until the bank is imported again.
 */
export async function loadFacets(store: Pick<QuestionStore, 'getMeta' | 'query'>): Promise<QuestionFacet[]> {
  const meta = await store.getMeta();
  const key = meta ? `${meta.importedAt}:${meta.count}` : 'empty';
  if (cache?.key === key) return cache.facets;
  const facets = (await store.query({})).map(toFacet);
  cache = { key, facets };
  return facets;
}

export function clearFacetCache(): void {
  cache = null;
}
