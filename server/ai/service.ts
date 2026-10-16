// The AI layer on the local server. Builds candidates and facts from local data, calls Groq only
// when AI is on and a key exists, validates every reply, and falls back to the rule-based form.
// The key never leaves this process except in the Authorization header to Groq. Events hold ids,
// counts and outcomes only. Nothing here is on the timing or scoring path.

import { createHash, randomUUID } from 'node:crypto';
import { AI_MODEL, GROQ_POLICY_LINE } from '../../src/config/aiConfig';
import { DAY_MS } from '../../src/config/mistakeConfig';
import { PACE_TARGET_MS } from '../../src/config/paceConfig';
import { buildInsights, COACH_MAX, readReportReply, REPORT_SCHEMA, reportPrompt, ruleCoach, ruleNextWeek, ruleReport, type InsightInputs } from '../../src/services/ai/insights';
import { hiddenSessionIds } from '../../src/services/analytics/hidden';
import { insightInputsFrom } from '../../src/services/ai/insightInputs';
import {
  buildCandidates,
  buildWeakDrillPrompt,
  enforceConstraints,
  rankWeakSkills,
  readWeakDrillReply,
  ruleBasedGroups,
  ruleBasedOrder,
  WEAK_DRILL_SCHEMA,
} from '../../src/services/ai/weakDrill';
import { buildRows } from '../../src/services/browse/filter';
import { countableAttempts } from '../../src/services/drill/stats';
import { latestTags } from '../../src/services/mistakes/mistakes';
import type { AiFailure, AiPreview, CoachResult, AiSettings, AiStatus, AiTestResult, InsightReport, ReportPeriod, WeakDrillRequest, WeakDrillResult } from '../../src/types/ai';
import type { AnalyticsFilter, AnalyticsStore } from '../../src/types/analytics';
import { DEFAULT_ANALYTICS_FILTER } from '../../src/types/analytics';
import type { BrowseRow } from '../../src/types/browse';
import type { MistakeReason } from '../../src/types/mistakes';
import type { Question } from '../../src/types/sat';
import type { EventRecord } from '../../src/types/session';
import type { DiskBankStore } from '../bankStore';
import type { SqliteUserStore } from '../userDb';
import { chat, requestBody, type ChatRequest } from './groqClient';
import { KeyStore, redact } from './keyStore';

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

export interface AiDeps {
  users: SqliteUserStore;
  bank: Pick<DiskBankStore, 'query' | 'get'>;
  analytics: AnalyticsStore;
  keys: KeyStore;
  fetch: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  model?: string;
}

const FAILURE_NOTE: Record<AiFailure, string> = {
  off: 'AI is turned off in Settings, so this is the rule-based version.',
  no_key: 'This needs a Groq key in Settings. Showing the rule-based version.',
  rate_limited: 'Groq rate limit reached. Showing the rule-based version; try again in a minute.',
  timeout: 'Groq did not answer in time. Showing the rule-based version.',
  network: 'Could not reach Groq. Showing the rule-based version.',
  http: 'Groq returned an error. Showing the rule-based version.',
  invalid_reply: 'Groq sent a reply that broke the rules, so it was discarded. Showing the rule-based version.',
};

const hashOf = (parts: readonly string[]) => createHash('sha256').update(parts.join('\u0000')).digest('hex');

export class AiService {
  private readonly now: () => number;
  private readonly model: string;

  constructor(private readonly d: AiDeps) {
    this.now = d.now ?? Date.now;
    this.model = d.model ?? AI_MODEL;
  }

  // ---- settings and key ----

  async status(): Promise<AiStatus> {
    return { hasKey: await this.d.keys.has(), settings: this.d.users.aiSettings(), model: this.model, policyLine: GROQ_POLICY_LINE };
  }

  async setKey(key: string): Promise<AiStatus> {
    if (!KeyStore.isPlausible(key)) throw new AiError('That does not look like a Groq key.');
    await this.d.keys.set(key);
    return this.status();
  }

  async removeKey(): Promise<AiStatus> {
    await this.d.keys.remove();
    return this.status();
  }

  /** Applies a validated patch. Turning text on needs the one-time confirmation in the same patch or before. */
  async updateSettings(patch: Partial<AiSettings>): Promise<AiStatus> {
    const cur = this.d.users.aiSettings();
    const next: AiSettings = { ...cur, ...patch };
    if (next.includeText && next.textConfirmedAt === null) throw new AiError('Confirm that question text goes to Groq before turning it on.');
    this.d.users.saveAiSettings(next);
    return this.status();
  }

  async testConnection(): Promise<AiTestResult> {
    const key = await this.d.keys.get();
    if (!key) return { ok: false, message: 'No Groq key saved yet.' };
    const r = await chat(
      key,
      { model: this.model, system: 'Reply with JSON only.', user: '{"ping":true}', schemaName: 'ping', schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } } },
      { fetch: this.d.fetch, sleep: this.d.sleep, timeoutMs: this.d.timeoutMs },
    );
    this.log('test', r.ok ? 'ai' : 'rule', 0, false, r.ok ? null : r.failure);
    return r.ok ? { ok: true, message: `Connected to Groq (${this.model}).` } : { ok: false, message: redact(r.message, key) };
  }

  // ---- shared ----

  private log(feature: string, origin: 'ai' | 'rule', candidates: number, cached: boolean, failure: AiFailure | null): void {
    const e: EventRecord<'ai_call'> = {
      id: randomUUID(),
      sessionId: 'ai',
      mode: 'drill',
      questionId: null,
      type: 'ai_call',
      ts: this.now(),
      monoMs: 0,
      pageId: 'server',
      seq: 0,
      payload: { feature, origin, candidates, cached, failure },
    };
    void this.d.users.appendEvents([e]);
  }

  /** Why AI cannot run now, or null when it can. */
  private async blocker(): Promise<{ failure: AiFailure } | { key: string; settings: AiSettings }> {
    const settings = this.d.users.aiSettings();
    if (!settings.enabled) return { failure: 'off' };
    const key = await this.d.keys.get();
    if (!key) return { failure: 'no_key' };
    return { key, settings };
  }

  /** One call, cached by request hash. Only the reply is cached; the request is never stored. */
  private async call(feature: string, key: string, req: ChatRequest, regenerate = false): Promise<{ ok: true; json: unknown; cached: boolean } | { ok: false; failure: AiFailure }> {
    const hash = hashOf([feature, req.model, req.system, req.user]);
    if (!regenerate) {
      const hit = this.d.users.cachedReply(hash);
      if (hit !== null) {
        try {
          return { ok: true, json: JSON.parse(hit) as unknown, cached: true };
        } catch {
          // A damaged cache row is ignored and replaced.
        }
      }
    }
    const r = await chat(key, req, { fetch: this.d.fetch, sleep: this.d.sleep, timeoutMs: this.d.timeoutMs });
    if (!r.ok) return { ok: false, failure: r.failure };
    this.d.users.cacheReply(hash, feature, JSON.stringify(r.json));
    return { ok: true, json: r.json, cached: false };
  }

  private async rows(): Promise<{ rows: BrowseRow[]; byId: Map<string, BrowseRow>; questions: Question[] }> {
    const questions = await this.d.bank.query({});
    const rows = buildRows(questions, await this.d.users.questionStatus());
    return { rows, byId: new Map(rows.map((r) => [r.id, r])), questions };
  }

  // ---- weak-skill drill ----

  private async weakDrillParts(req: WeakDrillRequest, includeText: boolean) {
    const { rows, byId, questions } = await this.rows();
    const [attempts, sessions, tags] = await Promise.all([this.d.users.listAttempts(), this.d.users.listSessions(), this.d.users.listTags()]);
    // Hidden sessions (early random clicks) do not shape the ranking; their questions still count as seen.
    const hidden = hiddenSessionIds(sessions, await this.d.users.listHidden());
    const first = [...countableAttempts(attempts, sessions, 'drill'), ...countableAttempts(attempts, sessions, 'exam')].filter((a) => !hidden.has(a.sessionId));
    const skills = rankWeakSkills(first, byId, req.section);
    const bands = new Map(questions.map((q): [string, number | null] => [q.id, Number.isFinite(q.scoreBand) ? q.scoreBand : null]));
    const candidates = buildCandidates(rows, skills, bands);
    const reasonsBySkill = new Map<string, Partial<Record<MistakeReason, number>>>();
    for (const t of latestTags(tags).values()) {
      const r = byId.get(t.questionId);
      if (!r) continue;
      const m = reasonsBySkill.get(r.skillCode) ?? {};
      m[t.reason] = (m[t.reason] ?? 0) + 1;
      reasonsBySkill.set(r.skillCode, m);
    }
    const timeBySkill = new Map<string, number[]>();
    for (const a of first) {
      const r = byId.get(a.questionId);
      if (!r) continue;
      timeBySkill.set(r.skillCode, [...(timeBySkill.get(r.skillCode) ?? []), a.timeMs]);
    }
    const paceBySkill = new Map<string, number>();
    for (const [skill, times] of timeBySkill) {
      const sorted = [...times].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] as number;
      const section = skills.find((s) => s.skillCode === skill)?.section;
      if (section) paceBySkill.set(skill, median / PACE_TARGET_MS[section]);
    }
    const qmap = includeText ? new Map(questions.filter((q) => candidates.some((c) => c.id === q.id)).map((q) => [q.id, q])) : null;
    const size = Math.max(1, Math.min(60, Math.round(req.size)));
    const prompt = buildWeakDrillPrompt({ candidates, skills, reasonsBySkill, paceBySkill, questions: qmap, size });
    return { candidates, skills, prompt, size };
  }

  private chatRequest(system: string, user: string, name: string, schema: Record<string, unknown>): ChatRequest {
    return { model: this.model, system, user, schemaName: name, schema };
  }

  async previewWeakDrill(req: WeakDrillRequest): Promise<AiPreview> {
    const s = this.d.users.aiSettings();
    const { prompt, candidates } = await this.weakDrillParts(req, s.includeText && s.textConfirmedAt !== null);
    return {
      feature: 'weak_drill',
      model: this.model,
      usedText: prompt.usedText,
      body: requestBody(this.chatRequest(prompt.system, prompt.user, 'weak_drill', WEAK_DRILL_SCHEMA)),
      questionCount: candidates.length,
      approxTokens: prompt.approxTokens,
    };
  }

  async weakDrill(req: WeakDrillRequest): Promise<WeakDrillResult> {
    const gate = await this.blocker();
    const textAllowed = 'settings' in gate && gate.settings.includeText && gate.settings.textConfirmedAt !== null;
    const { candidates, skills, prompt, size } = await this.weakDrillParts(req, textAllowed);
    const order = ruleBasedOrder(candidates);
    const rule = enforceConstraints([], candidates, size, order);
    const skillView = skills.slice(0, 8).map((s) => ({ skillCode: s.skillCode, skill: s.skill, section: s.section, answered: s.answered, correct: s.correct, lowerBound: s.lowerBound }));
    const ruleResult = (reason: AiFailure | null, notes: string[] = []): WeakDrillResult => ({
      origin: 'rule',
      fallbackReason: reason,
      questionIds: rule.ids,
      groups: ruleBasedGroups(rule.ids, candidates, skills),
      skills: skillView,
      cached: false,
      usedText: false,
      notes: [...(reason ? [FAILURE_NOTE[reason]] : []), ...notes, ...(candidates.length === 0 ? ['Not enough answers yet to find weak skills: answer at least 3 questions in a skill first.'] : [])],
    });
    if (candidates.length === 0) return ruleResult(null);
    if (req.ruleOnly) return ruleResult(null, ['Rule-based only, as you asked.']);
    if ('failure' in gate) {
      this.log('weak_drill', 'rule', candidates.length, false, gate.failure);
      return ruleResult(gate.failure);
    }
    const r = await this.call('weak_drill', gate.key, this.chatRequest(prompt.system, prompt.user, 'weak_drill', WEAK_DRILL_SCHEMA));
    if (!r.ok) {
      this.log('weak_drill', 'rule', candidates.length, false, r.failure);
      return ruleResult(r.failure);
    }
    const reply = readWeakDrillReply(r.json, prompt.aliases);
    const enforced = reply ? enforceConstraints(reply.order, candidates, size, order) : null;
    // A proposal that keeps fewer than half the drill after the rules is not used at all.
    if (!reply || !enforced || enforced.keptFromProposal < Math.ceil(Math.min(size, candidates.length) / 2)) {
      this.log('weak_drill', 'rule', candidates.length, r.cached, 'invalid_reply');
      return ruleResult('invalid_reply');
    }
    const kept = new Set(enforced.ids);
    const groups = reply.groups.map((g) => ({ ...g, questionIds: g.questionIds.filter((id) => kept.has(id)) })).filter((g) => g.questionIds.length > 0);
    const grouped = new Set(groups.flatMap((g) => g.questionIds));
    const extra = enforced.ids.filter((id) => !grouped.has(id));
    if (extra.length > 0) groups.push({ label: 'Added by the rules', reason: 'filled in to keep the mix of skills and difficulty', questionIds: extra });
    this.log('weak_drill', 'ai', candidates.length, r.cached, null);
    const notes: string[] = [];
    if (enforced.repaired) notes.push('Some of the AI picks broke the drill rules and were replaced by rule-based picks.');
    if (reply.unknown > 0 || reply.duplicates > 0) notes.push(`Discarded ${reply.unknown} unknown and ${reply.duplicates} repeated picks.`);
    return { origin: 'ai', fallbackReason: null, questionIds: enforced.ids, groups, skills: skillView, cached: r.cached, usedText: prompt.usedText, notes };
  }

  // ---- report ----

  private async periodFilter(period: ReportPeriod): Promise<{ f: AnalyticsFilter; before: AnalyticsFilter | null; from: number | null; to: number | null }> {
    const now = this.now();
    if (period === 'last_7_days') {
      const from = now - 7 * DAY_MS;
      return { f: { ...DEFAULT_ANALYTICS_FILTER, from }, before: { ...DEFAULT_ANALYTICS_FILTER, from: from - 7 * DAY_MS, to: from }, from, to: null };
    }
    if (period === 'last_test') {
      const tests = (await this.d.users.listSessions({ status: 'finished' })).filter((s) => s.test);
      const last = tests[0];
      if (last) return { f: { ...DEFAULT_ANALYTICS_FILTER, from: last.startedAt, to: last.finishedAt ?? now }, before: null, from: last.startedAt, to: last.finishedAt ?? now };
    }
    return { f: DEFAULT_ANALYTICS_FILTER, before: null, from: null, to: null };
  }

  private async insightInputs(period: ReportPeriod): Promise<InsightInputs> {
    const { f, before } = await this.periodFilter(period);
    return this.insightInputsFor(f, before, period);
  }

  /** Insight inputs for any analytics filter. Hidden sessions and their tags are left out unless the filter counts them. */
  async insightInputsFor(f: AnalyticsFilter, before: AnalyticsFilter | null, period: InsightInputs['period'] = 'custom'): Promise<InsightInputs> {
    const [overview, skills, timing, behavior, misses] = await Promise.all([
      this.d.analytics.overview(f),
      this.d.analytics.skills(f),
      this.d.analytics.timing(f),
      this.d.analytics.behavior(f),
      this.d.analytics.misses(f),
    ]);
    const { byId } = await this.rows();
    const [attempts, sessions, tags, hiddenRows] = await Promise.all([this.d.users.listAttempts(), this.d.users.listSessions(), this.d.users.listTags(), this.d.users.listHidden()]);
    const hidden = f.includeHidden ? new Set<string>() : hiddenSessionIds(sessions, hiddenRows);
    return insightInputsFrom({ filter: f, before, period, overview, skills, timing, behavior, misses, tags, hidden, inBank: (id) => byId.has(id), attempts, sessions, now: this.now() });
  }

  /**
   * The dashboard coach for one scope: at most COACH_MAX insights. AI-assisted when a key is set and
   * AI is on (the model only picks and words; code supplies numbers and the action), otherwise rule-based.
   */
  async coach(f: AnalyticsFilter, before: AnalyticsFilter | null): Promise<CoachResult> {
    const insights = buildInsights(await this.insightInputsFor(f, before));
    const rule = (reason: AiFailure | null): CoachResult => ({ origin: 'rule', fallbackReason: reason, lines: ruleCoach(insights), cached: false });
    if (insights.length === 0) return rule(null);
    const gate = await this.blocker();
    if ('failure' in gate) return rule(gate.failure);
    const p = reportPrompt(insights, 'custom');
    const r = await this.call('report', gate.key, this.chatRequest(p.system, p.user, 'report', REPORT_SCHEMA), false);
    if (!r.ok) {
      this.log('report', 'rule', insights.length, false, r.failure);
      return rule(r.failure);
    }
    const read = readReportReply(r.json, insights);
    if (!read) {
      this.log('report', 'rule', insights.length, r.cached, 'invalid_reply');
      return rule('invalid_reply');
    }
    this.log('report', 'ai', insights.length, r.cached, null);
    return { origin: 'ai', fallbackReason: null, lines: read.lines.slice(0, COACH_MAX), cached: r.cached };
  }

  async previewReport(period: ReportPeriod): Promise<AiPreview> {
    const insights = buildInsights(await this.insightInputs(period));
    const p = reportPrompt(insights, period);
    return { feature: 'report', model: this.model, usedText: false, body: requestBody(this.chatRequest(p.system, p.user, 'report', REPORT_SCHEMA)), questionCount: 0, approxTokens: Math.ceil((p.system.length + p.user.length) / 4) };
  }

  async report(period: ReportPeriod, regenerate: boolean): Promise<InsightReport> {
    const insights = buildInsights(await this.insightInputs(period));
    const rule = (reason: AiFailure | null): InsightReport => ({
      origin: 'rule',
      fallbackReason: reason,
      period,
      lines: ruleReport(insights),
      nextWeek: ruleNextWeek(insights),
      dropped: 0,
      cached: false,
      generatedAt: this.now(),
    });
    const gate = await this.blocker();
    if ('failure' in gate) {
      this.log('report', 'rule', insights.length, false, gate.failure);
      return rule(gate.failure);
    }
    const p = reportPrompt(insights, period);
    const r = await this.call('report', gate.key, this.chatRequest(p.system, p.user, 'report', REPORT_SCHEMA), regenerate);
    if (!r.ok) {
      this.log('report', 'rule', insights.length, false, r.failure);
      return rule(r.failure);
    }
    const read = readReportReply(r.json, insights);
    if (!read) {
      this.log('report', 'rule', insights.length, r.cached, 'invalid_reply');
      return rule('invalid_reply');
    }
    this.log('report', 'ai', insights.length, r.cached, null);
    return { origin: 'ai', fallbackReason: null, period, lines: read.lines, nextWeek: read.nextWeek ?? ruleNextWeek(insights), dropped: read.dropped, cached: r.cached, generatedAt: this.now() };
  }

  /** The note for a failure, for the screen. */
  static note(f: AiFailure): string {
    return FAILURE_NOTE[f];
  }
}
