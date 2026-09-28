import { create } from 'zustand';
import {
  QuestionRecord,
  QuestionUserResponse,
  QuestionTelemetry,
  ModuleStage,
  ModuleRoute,
  SessionRecord,
  IRTItemScore,
} from '../types/sat';
import {
  assembleReadingWritingModule,
  assembleMathModule,
  evaluateAnswer,
} from '../services/testAssembly';
import {
  estimateLatentAbilityEAP,
  scaleAbilityToSectionScore,
} from '../services/scoring';
import { dbAdapter } from '../services/db';

export type ExamStatus =
  | 'idle'
  | 'calibrating'
  | 'testing'
  | 'module_review'
  | 'break'
  | 'results';

interface ModuleState {
  questions: QuestionRecord[];
  responses: Record<string, QuestionUserResponse>;
  telemetry: Record<string, QuestionTelemetry>;
  timeRemainingSec: number;
  route?: ModuleRoute;
  rawScore?: number;
}

interface ExamStoreState {
  status: ExamStatus;
  sessionId: string | null;
  activeStage: ModuleStage;
  currentIndex: number;

  // Module States
  modules: Record<ModuleStage, ModuleState>;

  // Routing Results
  rwModule2Route: ModuleRoute;
  mathModule2Route: ModuleRoute;

  // Timer controls
  isTimerHidden: boolean;
  fiveMinWarningTriggered: boolean;
  showFiveMinModal: boolean;

  // Modals & Panels
  isDesmosOpen: boolean;
  isReferenceOpen: boolean;
  isDrawerOpen: boolean;

  // Completed Session Result
  completedSession: SessionRecord | null;

  // Actions
  setStatus: (status: ExamStatus) => void;
  startNewExam: () => Promise<void>;
  setCurrentIndex: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  selectOption: (optionKey: string) => void;
  setSprAnswer: (value: string) => void;
  toggleEliminateOption: (optionKey: string) => void;
  toggleFlag: () => void;
  toggleTimerVisibility: () => void;
  dismissFiveMinModal: () => void;
  toggleDesmos: () => void;
  toggleReference: () => void;
  toggleDrawer: (open?: boolean) => void;
  tickTimer: () => void;
  updateTelemetry: (dwellDeltaMs: number, desmosDeltaMs?: number) => void;
  submitCurrentModule: () => Promise<void>;
  resumeFromBreak: () => void;
  loadPastSession: (session: SessionRecord) => void;
}

const MODULE_TIMES: Record<ModuleStage, number> = {
  rw_m1: 32 * 60, // 32 minutes (official Digital SAT)
  rw_m2: 32 * 60,
  math_m1: 35 * 60, // 35 minutes (official Digital SAT)
  math_m2: 35 * 60,
};

const createEmptyModuleState = (stage: ModuleStage): ModuleState => ({
  questions: [],
  responses: {},
  telemetry: {},
  timeRemainingSec: MODULE_TIMES[stage],
});

export const useExamStore = create<ExamStoreState>((set, get) => ({
  status: 'idle',
  sessionId: null,
  activeStage: 'rw_m1',
  currentIndex: 0,

  modules: {
    rw_m1: createEmptyModuleState('rw_m1'),
    rw_m2: createEmptyModuleState('rw_m2'),
    math_m1: createEmptyModuleState('math_m1'),
    math_m2: createEmptyModuleState('math_m2'),
  },

  rwModule2Route: 'Easy',
  mathModule2Route: 'Easy',

  isTimerHidden: false,
  fiveMinWarningTriggered: false,
  showFiveMinModal: false,

  isDesmosOpen: false,
  isReferenceOpen: false,
  isDrawerOpen: false,

  completedSession: null,

  setStatus: (status) => set({ status }),

  startNewExam: async () => {
    // Generate fresh session ID
    const sessionId = `sat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Ensure database is seeded
    await dbAdapter.seedInitialIfEmpty();

    // Assemble Module 1 for Reading & Writing
    const rwM1Questions = await assembleReadingWritingModule('m1');

    // Initialize telemetry & responses map
    const responses: Record<string, QuestionUserResponse> = {};
    const telemetry: Record<string, QuestionTelemetry> = {};

    rwM1Questions.forEach((q) => {
      responses[q.id] = { answer: '', eliminatedChoices: [], flagged: false };
      telemetry[q.id] = {
        question_id: q.id,
        dwell_time_ms: 0,
        first_click_latency_ms: null,
        option_switch_chain: [],
        elimination_history: [],
        flag_toggled: false,
        desmos_opened_duration_ms: 0,
        visited_count: 0,
        last_visited_timestamp: Date.now(),
      };
    });

    set({
      status: 'testing',
      sessionId,
      activeStage: 'rw_m1',
      currentIndex: 0,
      modules: {
        rw_m1: {
          questions: rwM1Questions,
          responses,
          telemetry,
          timeRemainingSec: MODULE_TIMES.rw_m1,
        },
        rw_m2: createEmptyModuleState('rw_m2'),
        math_m1: createEmptyModuleState('math_m1'),
        math_m2: createEmptyModuleState('math_m2'),
      },
      rwModule2Route: 'Easy',
      mathModule2Route: 'Easy',
      isTimerHidden: false,
      fiveMinWarningTriggered: false,
      showFiveMinModal: false,
      isDesmosOpen: false,
      isReferenceOpen: false,
      isDrawerOpen: false,
      completedSession: null,
    });
  },

  setCurrentIndex: (index) => {
    const { modules, activeStage } = get();
    const currentModule = modules[activeStage];
    if (index >= 0 && index < currentModule.questions.length) {
      set({ currentIndex: index });
    }
  },

  nextQuestion: () => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    if (currentIndex < currentModule.questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    } else {
      // Last question: open review matrix
      set({ isDrawerOpen: true });
    }
  },

  prevQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  selectOption: (optionKey) => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    const currentQ = currentModule.questions[currentIndex];
    if (!currentQ) return;

    const existingResp = currentModule.responses[currentQ.id] || {
      answer: '',
      eliminatedChoices: [],
      flagged: false,
    };

    // Cannot select eliminated option
    if (existingResp.eliminatedChoices.includes(optionKey)) return;

    const existingTelem = currentModule.telemetry[currentQ.id];
    const now = Date.now();
    const firstLatency =
      existingTelem.first_click_latency_ms === null
        ? now - existingTelem.last_visited_timestamp
        : existingTelem.first_click_latency_ms;

    const updatedChain = [...existingTelem.option_switch_chain];
    if (existingResp.answer !== optionKey) {
      updatedChain.push(optionKey);
    }

    set({
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          responses: {
            ...currentModule.responses,
            [currentQ.id]: {
              ...existingResp,
              answer: optionKey,
            },
          },
          telemetry: {
            ...currentModule.telemetry,
            [currentQ.id]: {
              ...existingTelem,
              first_click_latency_ms: firstLatency,
              option_switch_chain: updatedChain,
            },
          },
        },
      },
    });
  },

  setSprAnswer: (value) => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    const currentQ = currentModule.questions[currentIndex];
    if (!currentQ) return;

    const existingResp = currentModule.responses[currentQ.id] || {
      answer: '',
      eliminatedChoices: [],
      flagged: false,
    };

    const existingTelem = currentModule.telemetry[currentQ.id];
    const now = Date.now();
    const firstLatency =
      existingTelem.first_click_latency_ms === null
        ? now - existingTelem.last_visited_timestamp
        : existingTelem.first_click_latency_ms;

    set({
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          responses: {
            ...currentModule.responses,
            [currentQ.id]: {
              ...existingResp,
              answer: value,
            },
          },
          telemetry: {
            ...currentModule.telemetry,
            [currentQ.id]: {
              ...existingTelem,
              first_click_latency_ms: firstLatency,
            },
          },
        },
      },
    });
  },

  toggleEliminateOption: (optionKey) => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    const currentQ = currentModule.questions[currentIndex];
    if (!currentQ) return;

    const existingResp = currentModule.responses[currentQ.id] || {
      answer: '',
      eliminatedChoices: [],
      flagged: false,
    };
    const existingTelem = currentModule.telemetry[currentQ.id];

    const isEliminated = existingResp.eliminatedChoices.includes(optionKey);
    const newEliminated = isEliminated
      ? existingResp.eliminatedChoices.filter((k) => k !== optionKey)
      : [...existingResp.eliminatedChoices, optionKey];

    // If active answer was eliminated, clear it
    const newAnswer =
      !isEliminated && existingResp.answer === optionKey ? '' : existingResp.answer;

    const eliminationHist = [...existingTelem.elimination_history];
    if (!isEliminated && !eliminationHist.includes(optionKey)) {
      eliminationHist.push(optionKey);
    }

    set({
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          responses: {
            ...currentModule.responses,
            [currentQ.id]: {
              ...existingResp,
              answer: newAnswer,
              eliminatedChoices: newEliminated,
            },
          },
          telemetry: {
            ...currentModule.telemetry,
            [currentQ.id]: {
              ...existingTelem,
              elimination_history: eliminationHist,
            },
          },
        },
      },
    });
  },

  toggleFlag: () => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    const currentQ = currentModule.questions[currentIndex];
    if (!currentQ) return;

    const existingResp = currentModule.responses[currentQ.id] || {
      answer: '',
      eliminatedChoices: [],
      flagged: false,
    };
    const existingTelem = currentModule.telemetry[currentQ.id];

    set({
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          responses: {
            ...currentModule.responses,
            [currentQ.id]: {
              ...existingResp,
              flagged: !existingResp.flagged,
            },
          },
          telemetry: {
            ...currentModule.telemetry,
            [currentQ.id]: {
              ...existingTelem,
              flag_toggled: true,
            },
          },
        },
      },
    });
  },

  toggleTimerVisibility: () => {
    const { fiveMinWarningTriggered, isTimerHidden } = get();
    // Involuntary lock: cannot hide timer under 5 minutes (300 seconds)
    if (fiveMinWarningTriggered) return;
    set({ isTimerHidden: !isTimerHidden });
  },

  dismissFiveMinModal: () => {
    set({ showFiveMinModal: false });
  },

  toggleDesmos: () => {
    set((state) => ({ isDesmosOpen: !state.isDesmosOpen }));
  },

  toggleReference: () => {
    set((state) => ({ isReferenceOpen: !state.isReferenceOpen }));
  },

  toggleDrawer: (open) => {
    set((state) => ({ isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen }));
  },

  tickTimer: () => {
    const { status, modules, activeStage, fiveMinWarningTriggered, isTimerHidden } = get();
    if (status !== 'testing') return;

    const currentModule = modules[activeStage];
    const newRemaining = Math.max(0, currentModule.timeRemainingSec - 1);

    // Official 5-minute involuntary reveal threshold (<= 300s)
    let triggered = fiveMinWarningTriggered;
    let showModal = false;
    let hidden = isTimerHidden;

    if (newRemaining <= 300 && !fiveMinWarningTriggered) {
      triggered = true;
      showModal = true;
      hidden = false; // Involuntary unhide
    }

    set({
      isTimerHidden: hidden,
      fiveMinWarningTriggered: triggered,
      showFiveMinModal: showModal || get().showFiveMinModal,
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          timeRemainingSec: newRemaining,
        },
      },
    });

    // Auto-advance if time expires
    if (newRemaining === 0) {
      get().submitCurrentModule();
    }
  },

  updateTelemetry: (dwellDeltaMs, desmosDeltaMs = 0) => {
    const { modules, activeStage, currentIndex } = get();
    const currentModule = modules[activeStage];
    const currentQ = currentModule.questions[currentIndex];
    if (!currentQ) return;

    const existingTelem = currentModule.telemetry[currentQ.id];
    if (!existingTelem) return;

    set({
      modules: {
        ...modules,
        [activeStage]: {
          ...currentModule,
          telemetry: {
            ...currentModule.telemetry,
            [currentQ.id]: {
              ...existingTelem,
              dwell_time_ms: existingTelem.dwell_time_ms + dwellDeltaMs,
              desmos_opened_duration_ms:
                existingTelem.desmos_opened_duration_ms + desmosDeltaMs,
            },
          },
        },
      },
    });
  },

  submitCurrentModule: async () => {
    const {
      activeStage,
      modules,
      rwModule2Route,
      mathModule2Route,
      sessionId,
    } = get();
    const currentModule = modules[activeStage];

    // Compute raw score for this module
    let rawScore = 0;
    currentModule.questions.forEach((q) => {
      const resp = currentModule.responses[q.id];
      if (evaluateAnswer(resp?.answer, q.correct_answer, q.format)) {
        rawScore++;
      }
    });

    const updatedCurrentModule: ModuleState = {
      ...currentModule,
      rawScore,
    };

    // Close any active overlays
    set({
      isDrawerOpen: false,
      isDesmosOpen: false,
      isReferenceOpen: false,
      fiveMinWarningTriggered: false,
      showFiveMinModal: false,
    });

    // Transition Logic
    if (activeStage === 'rw_m1') {
      // Official decision gate: RW M1 raw >= 18 / 27 (approx 66.7%) -> Hard Module 2
      const route: ModuleRoute = rawScore >= 18 ? 'Hard' : 'Easy';
      const rwM2Questions = await assembleReadingWritingModule('m2', route);

      const m2Responses: Record<string, QuestionUserResponse> = {};
      const m2Telemetry: Record<string, QuestionTelemetry> = {};
      rwM2Questions.forEach((q) => {
        m2Responses[q.id] = { answer: '', eliminatedChoices: [], flagged: false };
        m2Telemetry[q.id] = {
          question_id: q.id,
          dwell_time_ms: 0,
          first_click_latency_ms: null,
          option_switch_chain: [],
          elimination_history: [],
          flag_toggled: false,
          desmos_opened_duration_ms: 0,
          visited_count: 0,
          last_visited_timestamp: Date.now(),
        };
      });

      set({
        activeStage: 'rw_m2',
        currentIndex: 0,
        rwModule2Route: route,
        modules: {
          ...modules,
          rw_m1: updatedCurrentModule,
          rw_m2: {
            questions: rwM2Questions,
            responses: m2Responses,
            telemetry: m2Telemetry,
            timeRemainingSec: MODULE_TIMES.rw_m2,
            route,
          },
        },
      });
    } else if (activeStage === 'rw_m2') {
      // Completed Section 1 (Reading & Writing). Enter 10-Minute Section Break!
      set({
        status: 'break',
        modules: {
          ...modules,
          rw_m2: updatedCurrentModule,
        },
      });
    } else if (activeStage === 'math_m1') {
      // Official decision gate: Math M1 raw >= 14 / 22 (approx 63.6%) -> Hard Module 2
      const route: ModuleRoute = rawScore >= 14 ? 'Hard' : 'Easy';
      const mathM2Questions = await assembleMathModule('m2', route);

      const m2Responses: Record<string, QuestionUserResponse> = {};
      const m2Telemetry: Record<string, QuestionTelemetry> = {};
      mathM2Questions.forEach((q) => {
        m2Responses[q.id] = { answer: '', eliminatedChoices: [], flagged: false };
        m2Telemetry[q.id] = {
          question_id: q.id,
          dwell_time_ms: 0,
          first_click_latency_ms: null,
          option_switch_chain: [],
          elimination_history: [],
          flag_toggled: false,
          desmos_opened_duration_ms: 0,
          visited_count: 0,
          last_visited_timestamp: Date.now(),
        };
      });

      set({
        activeStage: 'math_m2',
        currentIndex: 0,
        mathModule2Route: route,
        modules: {
          ...modules,
          math_m1: updatedCurrentModule,
          math_m2: {
            questions: mathM2Questions,
            responses: m2Responses,
            telemetry: m2Telemetry,
            timeRemainingSec: MODULE_TIMES.math_m2,
            route,
          },
        },
      });
    } else if (activeStage === 'math_m2') {
      // All modules complete! Execute 2PL IRT scoring engine
      const updatedModules = {
        ...modules,
        math_m2: updatedCurrentModule,
      };

      // Extract item scores for RW
      const rwItems: IRTItemScore[] = [];
      ['rw_m1', 'rw_m2'].forEach((stg) => {
        const m = updatedModules[stg as ModuleStage];
        m.questions.forEach((q) => {
          const resp = m.responses[q.id];
          const isCorrect = evaluateAnswer(resp?.answer, q.correct_answer, q.format);
          rwItems.push({
            irt_a: q.irt_a,
            irt_b: q.irt_b,
            correct: isCorrect,
            question_id: q.id,
          });
        });
      });

      // Extract item scores for Math
      const mathItems: IRTItemScore[] = [];
      ['math_m1', 'math_m2'].forEach((stg) => {
        const m = updatedModules[stg as ModuleStage];
        m.questions.forEach((q) => {
          const resp = m.responses[q.id];
          const isCorrect = evaluateAnswer(resp?.answer, q.correct_answer, q.format);
          mathItems.push({
            irt_a: q.irt_a,
            irt_b: q.irt_b,
            correct: isCorrect,
            question_id: q.id,
          });
        });
      });

      // Compute Bayesian EAP ability estimates
      const rwTheta = estimateLatentAbilityEAP(rwItems);
      const mathTheta = estimateLatentAbilityEAP(mathItems);

      // Convert to 200–800 section scores enforcing Module 2 Easy ceiling
      const rwScore = scaleAbilityToSectionScore(rwTheta, rwModule2Route);
      const mathScore = scaleAbilityToSectionScore(mathTheta, mathModule2Route);
      const compositeScore = rwScore + mathScore;

      const rwM1Raw = updatedModules.rw_m1.rawScore || 0;
      const rwM2Raw = updatedModules.rw_m2.rawScore || 0;
      const mathM1Raw = updatedModules.math_m1.rawScore || 0;
      const mathM2Raw = updatedModules.math_m2.rawScore || 0;

      const sessionRecord: SessionRecord = {
        session_id: sessionId || `sat-${Date.now()}`,
        timestamp: Date.now(),
        composite_score: compositeScore,
        rw_score: rwScore,
        math_score: mathScore,
        rw_m1_raw: rwM1Raw,
        rw_m1_total: updatedModules.rw_m1.questions.length,
        rw_m2_raw: rwM2Raw,
        rw_m2_total: updatedModules.rw_m2.questions.length,
        rw_m2_route: rwModule2Route,
        math_m1_raw: mathM1Raw,
        math_m1_total: updatedModules.math_m1.questions.length,
        math_m2_raw: mathM2Raw,
        math_m2_total: updatedModules.math_m2.questions.length,
        math_m2_route: mathModule2Route,
        rw_theta: rwTheta,
        math_theta: mathTheta,
        telemetry_blob: {
          modules: {
            rw_m1: {
              questions: updatedModules.rw_m1.questions,
              responses: updatedModules.rw_m1.responses,
              telemetry: updatedModules.rw_m1.telemetry,
            },
            rw_m2: {
              questions: updatedModules.rw_m2.questions,
              responses: updatedModules.rw_m2.responses,
              telemetry: updatedModules.rw_m2.telemetry,
            },
            math_m1: {
              questions: updatedModules.math_m1.questions,
              responses: updatedModules.math_m1.responses,
              telemetry: updatedModules.math_m1.telemetry,
            },
            math_m2: {
              questions: updatedModules.math_m2.questions,
              responses: updatedModules.math_m2.responses,
              telemetry: updatedModules.math_m2.telemetry,
            },
          },
        },
      };

      // Persist completed session into IndexedDB
      await dbAdapter.saveSession(sessionRecord);

      set({
        status: 'results',
        modules: updatedModules,
        completedSession: sessionRecord,
      });
    }
  },

  resumeFromBreak: async () => {
    const { modules } = get();
    // Assemble Math Module 1
    const mathM1Questions = await assembleMathModule('m1');

    const mResponses: Record<string, QuestionUserResponse> = {};
    const mTelemetry: Record<string, QuestionTelemetry> = {};
    mathM1Questions.forEach((q) => {
      mResponses[q.id] = { answer: '', eliminatedChoices: [], flagged: false };
      mTelemetry[q.id] = {
        question_id: q.id,
        dwell_time_ms: 0,
        first_click_latency_ms: null,
        option_switch_chain: [],
        elimination_history: [],
        flag_toggled: false,
        desmos_opened_duration_ms: 0,
        visited_count: 0,
        last_visited_timestamp: Date.now(),
      };
    });

    set({
      status: 'testing',
      activeStage: 'math_m1',
      currentIndex: 0,
      fiveMinWarningTriggered: false,
      showFiveMinModal: false,
      modules: {
        ...modules,
        math_m1: {
          questions: mathM1Questions,
          responses: mResponses,
          telemetry: mTelemetry,
          timeRemainingSec: MODULE_TIMES.math_m1,
        },
      },
    });
  },

  loadPastSession: (session) => {
    set({
      completedSession: session,
      status: 'results',
    });
  },
}));
