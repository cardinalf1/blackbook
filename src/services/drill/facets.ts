// Pure helpers behind the drill setup screen: what can be chosen, and how many questions match.

import type { DrillConfig, QuestionFacet, TaxonomyDomain, TaxonomySection } from '../../types/drill';
import { SECTIONS, type Question } from '../../types/sat';

export function toFacet(q: Question): QuestionFacet {
  return {
    id: q.id,
    section: q.section,
    domainCode: q.domainCode,
    domain: q.domain,
    skillCode: q.skillCode,
    skill: q.skill,
    difficulty: q.difficulty,
    active: q.active,
  };
}

export function matchesConfig(f: QuestionFacet, c: DrillConfig): boolean {
  return (
    f.section === c.section &&
    (c.domainCode === 'all' || f.domainCode === c.domainCode) &&
    (c.skillCodes.length === 0 || c.skillCodes.includes(f.skillCode)) &&
    (c.difficulties.length === 0 || c.difficulties.includes(f.difficulty)) &&
    (!c.liveOnly || f.active)
  );
}

export function matchingFacets(facets: readonly QuestionFacet[], c: DrillConfig): QuestionFacet[] {
  return facets.filter((f) => matchesConfig(f, c));
}

export function matchingCount(facets: readonly QuestionFacet[], c: DrillConfig): number {
  let n = 0;
  for (const f of facets) if (matchesConfig(f, c)) n++;
  return n;
}

/** Never asks for more questions than match. The caller shows the reason when this changes the count. */
export function capCount(facets: readonly QuestionFacet[], c: DrillConfig): DrillConfig {
  return { ...c, count: Math.min(c.count, matchingCount(facets, c)) };
}

/** Sections, domains and skills present in the bank, sorted by name. */
export function buildTaxonomy(facets: readonly QuestionFacet[]): TaxonomySection[] {
  const out: TaxonomySection[] = [];
  for (const section of SECTIONS) {
    const domains = new Map<string, TaxonomyDomain>();
    for (const f of facets) {
      if (f.section !== section) continue;
      let d = domains.get(f.domainCode);
      if (!d) {
        d = { domainCode: f.domainCode, domain: f.domain, skills: [] };
        domains.set(f.domainCode, d);
      }
      const s = d.skills.find((x) => x.skillCode === f.skillCode);
      if (s) s.total++;
      else d.skills.push({ skillCode: f.skillCode, skill: f.skill, total: 1 });
    }
    if (domains.size === 0) continue;
    const list = [...domains.values()].sort((a, b) => a.domain.localeCompare(b.domain));
    for (const d of list) d.skills.sort((a, b) => a.skill.localeCompare(b.skill));
    out.push({ section, domains: list });
  }
  return out;
}
