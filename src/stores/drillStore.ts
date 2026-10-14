// Drill session state (Zustand). Every action persists through the injected stores, so a closed
// tab can resume. The factory takes its stores as arguments so tests run on in-memory ones.

import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { isCorrect } from '../services/answers';
import { selectQuestionIds, type Rng } from '../services/drill/select';
import {
  advance,
  createSession,
  currentQuestionId,
  recordElapsed,
  submitAnswer,
  toggleStrike,
} from '../services/drill/session';
import { attemptStore, questionStore } from '../services/storage';
import type { AttemptStore } from '../services/storage/attemptTypes';
import type { QuestionStore } from '../services/storage/types';
import type { DrillConfig, QuestionFacet, SessionRecord } from '../types/drill';
import type { ChoiceLetter, Question } from '../types/sat';

export interface DrillState {
  session: SessionRecord | null;
  /** Questions of the running session by id. Content is read from the bank, never copied to storage. */
  questions: Record<string, Question>;
  /** Ids of flagged questions. */
  flags: Record<string, true>;
  /** A saved unfinished session found at startup, waiting for Resume or Discard. */
  resumable: SessionRecord | null;
  error: string | null;
}

export interface DrillActions {
  /** Loads flags and looks for an unfinished session. Call once at startup. */
  init(): Promise<void>;
  start(config: DrillConfig, facets: readonly QuestionFacet[]): Promise<void>;
  resume(): Promise<void>;
  discardResumable(): Promise<void>;
  /** `timeMs` is the total focus time on this question, including time before a reload. */
  submit(response: string, timeMs: number): Promise<void>;
  next(): Promise<void>;
  strike(letter: ChoiceLetter): Promise<void>;
  toggleFlag(questionId: string): Promise<void>;
  /** Persists focus time so far on the current question. */
  saveElapsed(elapsedMs: number): Promise<void>;
  /** Leaves the finished or abandoned session screen. */
  close(): void;
}

export type DrillStore = DrillState & DrillActions;

export interface DrillDeps {
  attempts: AttemptStore;
  bank: Pick<QuestionStore, 'get'>;
  now?: () => number;
  newId?: () => string;
  rng?: Rng;
}

const EMPTY: DrillState = { session: null, questions: {}, flags: {}, resumable: null, error: null };

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createDrillStore(deps: DrillDeps): StoreApi<DrillStore> {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  /** Loads the session's questions. Unanswered questions missing from the bank are dropped from the queue. */
  async function load(record: SessionRecord): Promise<{ session: SessionRecord; questions: Record<string, Question> }> {
    const found = await Promise.all(record.queueIds.map((id) => deps.bank.get(id)));
    const questions: Record<string, Question> = {};
    const queueIds: string[] = [];
    let index = record.index;
    record.queueIds.forEach((id, i) => {
      const q = found[i];
      if (q) questions[id] = q;
      if (q || record.answered[id]) queueIds.push(id);
      else if (i < record.index) index--;
    });
    return { session: { ...record, queueIds, index: Math.min(Math.max(index, 0), Math.max(queueIds.length - 1, 0)) }, questions };
  }

  return createStore<DrillStore>()((set, get) => {
    const persist = async (session: SessionRecord) => {
      set({ session });
      try {
        await deps.attempts.saveSession(session);
      } catch (e) {
        set({ error: `Could not save your session: ${msg(e)}` });
      }
    };

    return {
      ...EMPTY,

      async init() {
        try {
          const [flags, active] = await Promise.all([deps.attempts.listFlags(), deps.attempts.getActiveSession()]);
          set({ flags: Object.fromEntries(flags.map((f) => [f.questionId, true as const])), resumable: active, error: null });
        } catch (e) {
          set({ error: `Could not open your saved data: ${msg(e)}` });
        }
      },

      async start(config, facets) {
        try {
          const attempts = await deps.attempts.listAttempts();
          const ids = selectQuestionIds(facets, config, attempts, deps.rng);
          if (ids.length === 0) {
            set({ error: 'No questions match that setup.' });
            return;
          }
          const stale = get().resumable;
          if (stale) await deps.attempts.deleteSession(stale.id);
          const session = createSession(newId(), { ...config, count: ids.length }, ids, now());
          const { questions } = await load(session);
          await persist(session);
          set({ questions, resumable: null, error: null });
        } catch (e) {
          set({ error: `Could not start the drill: ${msg(e)}` });
        }
      },

      async resume() {
        const record = get().resumable;
        if (!record) return;
        try {
          const { session, questions } = await load(record);
          await persist(session);
          set({ questions, resumable: null, error: null });
        } catch (e) {
          set({ error: `Could not resume: ${msg(e)}` });
        }
      },

      async discardResumable() {
        const record = get().resumable;
        if (!record) return;
        await deps.attempts.deleteSession(record.id);
        set({ resumable: null });
      },

      async submit(response, timeMs) {
        const { session, questions } = get();
        if (!session) return;
        const id = currentQuestionId(session);
        const q = id === null ? undefined : questions[id];
        if (id === null || !q) return;
        const result = submitAnswer(session, id, response, isCorrect(q.answer, response), timeMs, now());
        if (!result.attempt) return;
        try {
          await deps.attempts.addAttempt(result.attempt);
        } catch (e) {
          set({ error: `Could not save your answer: ${msg(e)}` });
          return;
        }
        await persist(result.session);
      },

      async next() {
        const { session } = get();
        if (!session) return;
        const after = advance(session);
        if (after !== session) await persist(after);
      },

      async strike(letter) {
        const { session } = get();
        const id = session ? currentQuestionId(session) : null;
        if (!session || id === null) return;
        const after = toggleStrike(session, id, letter);
        if (after !== session) await persist(after);
      },

      async toggleFlag(questionId) {
        const flagged = get().flags[questionId] === undefined;
        const flags = { ...get().flags };
        if (flagged) flags[questionId] = true;
        else delete flags[questionId];
        set({ flags });
        try {
          await deps.attempts.setFlag(questionId, flagged);
        } catch (e) {
          set({ error: `Could not save the flag: ${msg(e)}` });
        }
      },

      async saveElapsed(elapsedMs) {
        const { session } = get();
        if (!session) return;
        const after = recordElapsed(session, elapsedMs);
        if (after !== session) await persist(after);
      },

      close() {
        set({ session: null, questions: {} });
      },
    };
  });
}

/** App-wide store wired to IndexedDB. */
export const drillStore = createDrillStore({ attempts: attemptStore, bank: questionStore });

export function useDrill<T>(selector: (s: DrillStore) => T): T {
  return useStore(drillStore, selector);
}
