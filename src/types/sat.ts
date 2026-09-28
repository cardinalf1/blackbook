export type SectionType = 'reading_writing' | 'math';
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type QuestionFormat = 'mcq' | 'spr';
export type ModuleRoute = 'Easy' | 'Hard';
export type ModuleStage = 'rw_m1' | 'rw_m2' | 'math_m1' | 'math_m2';

export interface ChoiceItem {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface QuestionRecord {
  id: string;                                          // Internal UUID
  cb_question_id: string;                              // CB Educator Bank identifier
  section: SectionType;
  domain: string;                                      // e.g. "Craft and Structure", "Algebra"
  skill: string;                                       // e.g. "Transitions", "Linear Equations"
  difficulty: DifficultyLevel;
  format: QuestionFormat;
  stimulus_html: string;                               // Reading passage or tabular context
  stem_html: string;                                   // Question stem
  choices: ChoiceItem[];
  correct_answer: string;                              // "A" | "B" | "C" | "D" or numeric string
  rationale_html: string;
  irt_b: number;                                       // Baseline difficulty parameter
  irt_a: number;                                       // Baseline discrimination parameter
  has_algebra_or_poly?: boolean;                       // Flag for Desmos Arbitrage detection
}

export interface QuestionTelemetry {
  question_id: string;
  dwell_time_ms: number;
  first_click_latency_ms: number | null;
  option_switch_chain: string[];                       // e.g. ["A", "C", "B"]
  elimination_history: string[];                       // e.g. ["A", "D"]
  flag_toggled: boolean;
  desmos_opened_duration_ms: number;
  visited_count: number;
  last_visited_timestamp: number;
}

export interface QuestionUserResponse {
  answer: string;                                      // "A"|"B"|"C"|"D" or SPR text
  eliminatedChoices: string[];                         // ["A", "B"]
  flagged: boolean;
}

export interface ModuleExamState {
  questions: QuestionRecord[];
  responses: Record<string, QuestionUserResponse>;     // questionId -> response
  telemetry: Record<string, QuestionTelemetry>;        // questionId -> telemetry
  currentIndex: number;
  startTime: number;
  timeRemainingSec: number;
  isComplete: boolean;
  rawScore?: number;
  routedDifficulty?: ModuleRoute;
}

export interface SessionRecord {
  session_id: string;
  timestamp: number;
  composite_score: number;
  rw_score: number;
  math_score: number;
  rw_m1_raw: number;
  rw_m1_total: number;
  rw_m2_raw: number;
  rw_m2_total: number;
  rw_m2_route: ModuleRoute;
  math_m1_raw: number;
  math_m1_total: number;
  math_m2_raw: number;
  math_m2_total: number;
  math_m2_route: ModuleRoute;
  rw_theta: number;
  math_theta: number;
  telemetry_blob: {
    modules: Record<ModuleStage, {
      questions: QuestionRecord[];
      responses: Record<string, QuestionUserResponse>;
      telemetry: Record<string, QuestionTelemetry>;
    }>;
  };
}

export interface IngestionProgress {
  stage: 'idle' | 'fetching_directory' | 'downloading_items' | 'sanitizing_katex' | 'persisting' | 'completed' | 'error';
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface IRTItemScore {
  irt_a: number;
  irt_b: number;
  correct: boolean;
  question_id: string;
}
