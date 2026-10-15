// A deterministic synthetic dataset for the analytics checks: invented questions, and sessions,
// attempts and events in the shapes the app stores. Sized by `attempts` and `events` so the same
// generator makes a small fixture for tests and the 5,000 attempt / 200,000 event load for timings.
// Nothing here resembles real question content (AGENTS.md rule 1).

import { createSession } from '../session/record';
import type { DrillConfig } from '../../types/drill';
import type { ChoiceLetter, Difficulty, Question, Section } from '../../types/sat';
import type { Confidence, EventPayloads, EventRecord, EventType, SessionRecord, StoredAttempt } from '../../types/session';
import type { ModuleKey, Route, ScoreEstimate, TestKind, TestState } from '../../types/test';
import type { RawData } from './brute';

export interface SynthOptions {
  seed?: number;
  /** Rough number of answered questions to generate. */
  attempts: number;
  /** Rough number of events; filler events pad the log up to this. */
  events: number;
  /** Questions removed from the returned bank after generation, so some attempts have no known skill. */
  orphanQuestions?: number;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS: readonly ChoiceLetter[] = ['A', 'B', 'C', 'D'];
const DIFFS: readonly Difficulty[] = ['E', 'M', 'H'];
const DAY = 86_400_000;
const BASE = Date.UTC(2026, 5, 1, 15, 0, 0);

export function synthQuestions(): Question[] {
  const out: Question[] = [];
  let n = 0;
  for (const section of ['rw', 'math'] as const) {
    for (let d = 0; d < 3; d++) {
      for (let s = 0; s < 4; s++) {
        for (let k = 0; k < 12; k++) {
          const difficulty = DIFFS[k % 3] as Difficulty;
          const spr = section === 'math' && k % 5 === 4;
          out.push({
            id: `sy-${String(n).padStart(5, '0')}`,
            source: 'digital',
            displayId: `sy${n}`,
            section,
            domainCode: `${section.toUpperCase()}D${d}`,
            domain: `${section === 'rw' ? 'Reading' : 'Math'} domain ${d}`,
            skillCode: `${section.toUpperCase()}D${d}S${s}`,
            skill: `${section === 'rw' ? 'Reading' : 'Math'} skill ${d}.${s}`,
            difficulty,
            scoreBand: difficulty === 'E' ? 2 : difficulty === 'M' ? 4 : 6,
            active: n % 7 !== 0,
            stimulusHtml: null,
            stemHtml: `<p>Synthetic ${n}</p>`,
            answer: spr
              ? { kind: 'spr', accepted: [String(10 + (n % 80))] }
              : { kind: 'mcq', choices: ['a', 'b', 'c', 'd'], correct: LETTERS[n % 4] as ChoiceLetter, keyOrigin: 'structured' },
            rationaleHtml: '<p>Synthetic rationale.</p>',
            updatedAt: BASE,
          });
          n++;
        }
      }
    }
  }
  return out;
}

export function synthData(opts: SynthOptions): RawData {
  const rand = rng(opts.seed ?? 1);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;
  const all = synthQuestions();
  const bySection: Record<Section, Question[]> = { rw: all.filter((q) => q.section === 'rw'), math: all.filter((q) => q.section === 'math') };
  const ability = new Map<string, number>();
  for (const q of all) if (!ability.has(q.skillCode)) ability.set(q.skillCode, 0.35 + rand() * 0.55);

  const sessions: SessionRecord[] = [];
  const attempts: StoredAttempt[] = [];
  const events: EventRecord[] = [];
  const fillPerAnswer = Math.max(0, opts.events / Math.max(1, opts.attempts) - 6);
  let attemptCount = 0;
  let sid = 0;
  let clock = BASE;

  const config = (section: Section, count: number): DrillConfig => ({ section, domainCode: 'all', skillCodes: [], difficulties: [], count, liveOnly: true });

  /** One session with its answers and events. Returns its record (already appended). */
  function build(opts2: {
    id: string;
    mode: 'drill' | 'exam';
    source: 'drill' | 'browse' | 'exam';
    section: Section;
    count: number;
    status: SessionRecord['status'];
    start: number;
    exam?: { moduleNumber: 1 | 2; tier: 'routing' | Route; testId?: string; pause: boolean; submittedBy: 'user' | 'timer'; durationMs: number };
    askConfidence: boolean;
  }): SessionRecord {
    const ids = [...bySection[opts2.section]].sort(() => rand() - 0.5).slice(0, opts2.count);
    const s = createSession(opts2.id, opts2.mode, config(opts2.section, opts2.count), ids.map((q) => q.id), opts2.start, opts2.source);
    s.askConfidence = opts2.askConfidence;
    const pageId = `${opts2.id}-p`;
    let seq = 0;
    let t = opts2.start;
    const log = <T extends EventType>(type: T, questionId: string | null, payload: EventPayloads[T]) => {
      events.push({ id: `${opts2.id}:e${seq}`, sessionId: opts2.id, mode: opts2.mode, questionId, type, ts: t, monoMs: t - opts2.start, pageId, seq: seq++, payload });
    };
    log('session_started', null, { count: ids.length, askConfidence: opts2.askConfidence });
    const exam = opts2.exam;
    const deadline = exam ? opts2.start + exam.durationMs : 0;
    const perQuestion = exam ? (exam.durationMs / ids.length) * (0.75 + rand() * 0.3) : 0;
    let alerted = false;
    let totalActive = 0;
    let correctCount = 0;
    let answered = 0;
    ids.forEach((q, index) => {
      const mean = exam ? perQuestion : (q.section === 'math' ? 70_000 : 50_000) * (q.difficulty === 'E' ? 0.7 : q.difficulty === 'M' ? 1 : 1.4);
      const timeMs = Math.max(2_000, Math.round(mean * Math.exp((rand() - 0.5) * 1.6)));
      if (exam && t + timeMs > deadline) return; // ran out of time
      if (exam && !alerted && t + timeMs > deadline - 300_000) {
        alerted = true;
        log('five_minute_alert_shown', null, {});
      }
      const answeredIt = rand() < (exam ? 0.93 : 0.97);
      const pCorrect = (ability.get(q.skillCode) as number) * (q.difficulty === 'E' ? 1.15 : q.difficulty === 'M' ? 0.95 : 0.7);
      const right = rand() < pCorrect;
      log('question_shown', q.id, { index, visit: 1 });
      const mcq = q.answer.kind === 'mcq';
      let response = '';
      let changes = 0;
      let struckAny = false;
      if (answeredIt) {
        if (q.answer.kind === 'mcq') {
          const correct = q.answer.correct;
          const wrong = LETTERS.filter((l) => l !== correct);
          const first = right && rand() < 0.9 ? correct : pick(wrong);
          if (rand() < 0.2) {
            struckAny = true;
            log('choice_struck', q.id, { choice: pick(wrong) });
            if (rand() < 0.4) log('choice_struck', q.id, { choice: pick(wrong) });
          }
          log('choice_selected', q.id, { choice: first });
          let cur: ChoiceLetter = first;
          const finalChoice: ChoiceLetter = right ? correct : pick(wrong);
          const swaps = rand() < 0.22 ? (rand() < 0.3 ? 2 : 1) : 0;
          for (let i = 0; i < swaps; i++) {
            const to: ChoiceLetter = i === swaps - 1 ? finalChoice : pick(LETTERS.filter((l) => l !== cur));
            if (to !== cur) {
              log('choice_changed', q.id, { from: cur, to });
              cur = to;
              changes++;
            }
          }
          if (cur !== finalChoice) {
            log('choice_changed', q.id, { from: cur, to: finalChoice });
            changes++;
          }
          response = finalChoice;
        } else {
          response = right ? q.answer.accepted[0] as string : String(int(1, 9));
          log('spr_changed', q.id, { value: response });
          if (rand() < 0.1) {
            const first = String(int(1, 9));
            log('spr_changed', q.id, { value: first });
            log('spr_changed', q.id, { value: response });
            changes++;
          }
        }
      }
      void mcq;
      void struckAny;
      for (let i = 0, k = Math.round(fillPerAnswer * (0.5 + rand())); i < k; i++) {
        const kind = i % 6;
        if (kind === 0) log('window_blur', null, {});
        else if (kind === 1) log('window_focus', null, {});
        else if (kind === 2) log('nav_next', null, { from: index });
        else if (kind === 3) log('idle_start', null, { thresholdMs: 30_000 });
        else if (kind === 4) log('idle_end', null, { idleMs: 31_000 });
        else log('nav_back', null, { from: index });
      }
      t += timeMs;
      totalActive += timeMs;
      log('question_hidden', q.id, { index, visitActiveMs: timeMs, reason: 'next' });
      const p = s.progress[q.id];
      if (p) {
        p.response = response === '' ? null : response;
        p.changes = changes;
        p.activeMs = timeMs;
        p.firstVisitMs = timeMs;
      }
      if (response === '') return;
      answered++;
      const correct = q.answer.kind === 'mcq' ? response === q.answer.correct : q.answer.accepted.includes(response);
      if (correct) correctCount++;
      const confidence: Confidence | null = opts2.askConfidence && rand() < 0.8 ? pick(['guess', 'unsure', 'sure'] as const) : null;
      const status: StoredAttempt['status'] = opts2.status === 'in_progress' && rand() < 0.5 ? 'draft' : 'final';
      attempts.push({
        id: `${opts2.id}:${q.id}`, sessionId: opts2.id, questionId: q.id, mode: opts2.mode, status, response, correct, timeMs,
        firstVisitMs: timeMs, changes, confidence, at: t,
      });
      if (status === 'final') attemptCount++;
    });
    if (opts2.status === 'finished') {
      s.status = 'finished';
      s.finishedAt = exam && exam.submittedBy === 'timer' ? deadline : t;
      s.lastActivityAt = s.finishedAt;
      s.score = { correct: correctCount, total: ids.length };
      log('session_finished', null, { correct: correctCount, total: ids.length, totalActiveMs: totalActive });
    } else {
      s.status = opts2.status;
      s.lastActivityAt = t;
    }
    void answered;
    s.totalActiveMs = totalActive;
    if (exam) {
      const done = s.finishedAt ?? t;
      s.exam = {
        module: { section: opts2.section, moduleNumber: exam.moduleNumber, tier: exam.tier },
        timer: { durationMs: exam.durationMs, deadlineAt: deadline, pausedRemainingMs: null },
        pauses: exam.pause ? [{ at: opts2.start + 60_000, reason: 'bathroom', resumedAt: opts2.start + 120_000 }] : [],
        phase: opts2.status === 'finished' ? 'submitted' : 'in_progress',
        submittedBy: opts2.status === 'finished' ? exam.submittedBy : null,
        timerHidden: false,
        fiveMinuteAlertShown: alerted,
        assemblyNotes: [],
        ...(exam.testId ? { testId: exam.testId } : {}),
      };
      void done;
    }
    sessions.push(s);
    return s;
  }

  const estimate = (version: number, sections: Section[], routes: Route[]): ScoreEstimate => {
    const ests = sections.map((section, i) => {
      const mid = int(30, 75) * 10;
      return { section, route: routes[i] as Route, weightedFraction: rand(), low: mid - 40, high: mid + 40, mid, capped: false, answered: 40, total: 49 };
    });
    return { configVersion: version, sections: ests, total: sections.length === 2 ? { low: ests[0]!.low + ests[1]!.low, high: ests[0]!.high + ests[1]!.high, mid: ests[0]!.mid + ests[1]!.mid } : null };
  };

  while (attemptCount < opts.attempts) {
    sid++;
    clock += int(2, 40) * 3_600_000 + (rand() < 0.3 ? DAY : 0);
    const roll = rand();
    const status: SessionRecord['status'] = rand() < 0.06 ? (rand() < 0.5 ? 'in_progress' : 'abandoned') : 'finished';
    const section: Section = rand() < 0.5 ? 'rw' : 'math';
    if (roll < 0.55) {
      build({ id: `d${sid}`, mode: 'drill', source: 'drill', section, count: int(5, 30), status, start: clock, askConfidence: rand() < 0.4 });
    } else if (roll < 0.65) {
      build({ id: `d${sid}`, mode: 'drill', source: 'browse', section, count: 1, status, start: clock, askConfidence: false });
    } else if (roll < 0.75) {
      build({ id: `m${sid}`, mode: 'exam', source: 'exam', section, count: section === 'rw' ? 27 : 22, status, start: clock, askConfidence: false,
        exam: { moduleNumber: 1, tier: 'routing', pause: rand() < 0.1, submittedBy: rand() < 0.3 ? 'timer' : 'user', durationMs: (section === 'rw' ? 32 : 35) * 60_000 } });
    } else {
      const kind: TestKind = roll < 0.88 ? (rand() < 0.5 ? 'rw' : 'math') : 'full';
      const sections: Section[] = kind === 'full' ? ['rw', 'math'] : [kind];
      const testId = `t${sid}`;
      const paused = rand() < 0.15;
      const routes: Route[] = sections.map(() => (rand() < 0.5 ? 'harder' : 'easier'));
      const slots: TestState['slots'] = {};
      let at = clock;
      sections.forEach((sec, i) => {
        for (const moduleNumber of [1, 2] as const) {
          const key = `${sec}${moduleNumber}` as ModuleKey;
          const m = build({
            id: `${testId}-${key}`, mode: 'exam', source: 'exam', section: sec, count: sec === 'rw' ? 27 : 22, status: 'finished', start: at, askConfidence: false,
            exam: { moduleNumber, tier: moduleNumber === 1 ? 'routing' : (routes[i] as Route), testId, pause: paused && moduleNumber === 2, submittedBy: rand() < 0.25 ? 'timer' : 'user', durationMs: (sec === 'rw' ? 32 : 35) * 60_000 },
          });
          slots[key] = { key, section: sec, moduleNumber, tier: moduleNumber === 1 ? 'routing' : (routes[i] as Route), questionIds: m.queueIds, notes: [], sessionId: m.id };
          at = (m.finishedAt ?? at) + 60_000;
        }
      });
      const container = createSession(testId, 'exam', config(sections[0] as Section, 0), [], clock, 'exam');
      container.status = 'finished';
      container.finishedAt = at;
      container.lastActivityAt = at;
      const version = rand() < 0.7 ? 1 : 2;
      container.test = {
        kind, steps: [], stepIndex: 0, slots, routing: [], break: null, includeSeen: false, paused,
        estimate: estimate(version, sections, routes), configVersion: version,
      };
      sessions.push(container);
      clock = at;
    }
  }

  // A few questions leave the bank, so some answers cannot be attributed to a skill.
  const drop = new Set<string>();
  while (drop.size < (opts.orphanQuestions ?? 3)) drop.add((all[int(0, all.length - 1)] as Question).id);
  return { sessions, attempts, events, questions: all.filter((q) => !drop.has(q.id)) };
}
