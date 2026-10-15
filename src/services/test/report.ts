// Builds the report for a full test or section run from its container and its module sessions.
// Pure: sessions and their reports come in. The estimate is computed here, from answers, question
// difficulty and routing only, so it can be recomputed and cross-checked (scripts/test-estimate.ts).

import type { Section } from '../../types/sat';
import type { BreakdownRow, ReportItem, SessionRecord, SessionReport } from '../../types/session';
import type { ModuleKey, RoutingDecision, ScoreEstimate, TestModuleReport, TestReport, TestSectionReport } from '../../types/test';
import { usedMs } from '../exam/timer';
import { estimateTest, type EstimateItem, type SectionEstimateInput } from './estimate';
import { sectionsOf } from './flow';
import { itemWeight } from './weights';

/** One module session with its built report, in test order. */
export interface ModuleData {
  key: ModuleKey;
  session: SessionRecord;
  report: SessionReport;
}

const SECTION_LABEL: Record<Section, string> = { rw: 'Reading and Writing', math: 'Math' };

export function estimateItem(it: ReportItem): EstimateItem {
  return { weight: itemWeight(it.question?.scoreBand, it.difficulty), correct: it.correct, answered: it.response !== null };
}

export function routingItems(report: SessionReport) {
  return report.items.map((it) => ({ weight: estimateItem(it).weight, correct: it.correct }));
}

function mergeRows(lists: readonly BreakdownRow[][]): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const r of lists.flat()) {
    const cur = rows.get(r.code) ?? { code: r.code, label: r.label, correct: 0, total: 0, activeMs: 0 };
    cur.correct += r.correct;
    cur.total += r.total;
    cur.activeMs += r.activeMs;
    rows.set(r.code, cur);
  }
  return [...rows.values()].sort((a, b) => a.correct / a.total - b.correct / b.total || a.label.localeCompare(b.label));
}

/** The estimate inputs for each section that has both modules submitted and a routing decision. */
export function estimateInputs(routing: readonly RoutingDecision[], modules: readonly ModuleData[]): SectionEstimateInput[] {
  const out: SectionEstimateInput[] = [];
  for (const section of ['rw', 'math'] as const) {
    const r = routing.find((x) => x.section === section);
    const mods = modules.filter((m) => m.session.exam?.module.section === section && m.session.status === 'finished');
    if (!r || mods.length < 2) continue;
    out.push({ section, route: r.route, items: mods.flatMap((m) => m.report.items.map(estimateItem)) });
  }
  return out;
}

export function computeEstimate(routing: readonly RoutingDecision[], modules: readonly ModuleData[]): ScoreEstimate | null {
  const inputs = estimateInputs(routing, modules);
  return inputs.length === 0 ? null : estimateTest(inputs);
}

export function moduleTitle(section: Section, moduleNumber: 1 | 2): string {
  return `Section ${section === 'rw' ? 1 : 2}, Module ${moduleNumber}: ${SECTION_LABEL[section]}`;
}

export function buildTestReport(container: SessionRecord, modules: readonly ModuleData[]): TestReport | null {
  const test = container.test;
  if (!test) return null;
  const sections: TestSectionReport[] = sectionsOf(test).map((section) => {
    const mods: TestModuleReport[] = [];
    for (const m of modules) {
      const exam = m.session.exam;
      if (!exam || exam.module.section !== section || m.session.status !== 'finished') continue;
      const at = m.session.finishedAt ?? m.session.lastActivityAt;
      const used = usedMs(exam.timer, at);
      mods.push({
        key: m.key,
        section,
        moduleNumber: exam.module.moduleNumber,
        tier: exam.module.tier,
        title: moduleTitle(section, exam.module.moduleNumber),
        correct: m.report.score.correct,
        total: m.report.score.total,
        timeUsedMs: used,
        timeLimitMs: exam.timer.durationMs,
        timeLeftMs: Math.max(0, exam.timer.durationMs - used),
        submittedBy: exam.submittedBy ?? 'user',
        pauses: exam.pauses,
        report: m.report,
      });
    }
    mods.sort((a, b) => a.moduleNumber - b.moduleNumber);
    const estimate = test.estimate?.sections.find((e) => e.section === section) ?? null;
    return {
      section,
      routing: test.routing.find((r) => r.section === section) ?? null,
      modules: mods,
      estimate,
      byDomain: mergeRows(mods.map((m) => m.report.byDomain)),
      bySkill: mergeRows(mods.map((m) => m.report.bySkill)),
    };
  });
  return {
    testId: container.id,
    kind: test.kind,
    startedAt: container.startedAt,
    finishedAt: container.finishedAt,
    paused: test.paused || sections.some((s) => s.modules.some((m) => m.pauses.length > 0)),
    estimate: test.estimate,
    sections,
    break: test.break,
  };
}
