// The test room (Phase 9): the tools and layout around an exam module, and the same tools in drills.
// Behavior and layout follow the real test app (docs/bluebook-ui-spec.md); the look is Blackbook's
// own (AGENTS.md rule 2). Screens are thin: all state and logic arrive through these props.

import type { ReactNode } from 'react';
import type { Section } from './sat';
import type { NavigatorItem } from './exam';

/** Every tool a section can offer. The per-section lists are in src/config/testRoomConfig.ts. */
export type ToolId =
  | 'calculator'
  | 'reference'
  | 'highlights'
  | 'eliminator'
  | 'markForReview'
  | 'questionMenu'
  | 'timerHide'
  | 'directions'
  | 'lineReader'
  | 'zoom'
  | 'more';

export type CalculatorMode = 'graphing' | 'scientific';

/** A floating panel's place and size in CSS pixels, relative to the viewport. */
export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Highlight colors and the underline. The tints are Blackbook's own. */
export type HighlightStyle = 'yellow' | 'blue' | 'pink' | 'underline';

// ---- Header ----

/** A header tool button (Calculator, Reference, Highlights & Notes). Underlined while its panel is open. */
export interface HeaderTool {
  id: 'calculator' | 'reference' | 'highlights';
  label: string;
  active: boolean;
  onClick: () => void;
}

export type MoreItemId = 'help' | 'shortcuts' | 'lineReader' | 'unscheduledBreak' | 'pause' | 'exit';

export interface MoreMenuItem {
  id: MoreItemId;
  label: string;
  /** For toggles such as the line reader: shown as on. */
  active?: boolean;
  onSelect: () => void;
}

export interface TestRoomHeaderProps {
  /** For example "Section 2, Module 1: Math". */
  sectionTitle: string;
  section: Section;
  directionsOpen: boolean;
  onToggleDirections: () => void;
  /** Milliseconds left, already computed from the deadline. */
  remainingMs: number;
  timerHidden: boolean;
  onToggleTimer: () => void;
  /** True while paused: the countdown shows "Paused". */
  paused: boolean;
  /** In display order. */
  tools: readonly HeaderTool[];
  moreOpen: boolean;
  onToggleMore: () => void;
  moreItems: readonly MoreMenuItem[];
  /** Current test-room zoom, shown small (e.g. 100). */
  zoomPercent: number;
}

/** The Directions dropdown text, written in Blackbook's own words. */
export interface DirectionsPanelProps {
  section: Section;
  onClose: () => void;
}

// ---- Footer, question menu, review ----

export interface TestRoomFooterProps {
  /** Left side. There is no stored user name, so this is the module label. */
  label: string;
  /** 0-based. */
  index: number;
  total: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** Not rendered on the first question. */
  onBack: () => void;
  /** Always "Next", also on the last question (it leads to the review screen). */
  onNext: () => void;
  /** True while an answer is being saved or a save failed: Back and Next are disabled. */
  disabled: boolean;
}

export interface QuestionMenuProps {
  /** For example "Section 2, Module 1: Math Questions". */
  title: string;
  items: readonly NavigatorItem[];
  /** 0-based index of the question on screen. */
  currentIndex: number;
  /** 0-based. */
  onJump: (index: number) => void;
  onClose: () => void;
  onGoToReview: () => void;
}

export interface ReviewScreenProps {
  title: string;
  items: readonly NavigatorItem[];
  /** 0-based. */
  onJump: (index: number) => void;
  /** Called after the user confirms inside the component; it warns that the module cannot be reopened. */
  onSubmit: () => void;
  busy: boolean;
}

// ---- Main area ----

export interface SplitPanesProps {
  /** Passage, response directions, or null (Math multiple choice): then the right pane is centered alone. */
  left: ReactNode | null;
  right: ReactNode;
  /** Docked panel on the far right (the reference sheet). It squeezes the panes; null when closed. */
  side: ReactNode | null;
  /** Share of the width given to the left pane, 0.2 to 0.8. */
  leftFraction: number;
  onResize: (fraction: number) => void;
}

/** The bar above each question. `eliminator` is absent on student-produced response questions. */
export interface QuestionBarProps {
  number: number;
  flagged: boolean;
  onToggleFlag: () => void;
  eliminator?: { on: boolean; onToggle: () => void };
}

export interface ReferencePanelProps {
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

/** A figure from question HTML with zoom in, zoom out, a percentage, Reset and full screen. */
export interface FigureFrameProps {
  /** Sanitized figure HTML (a <figure> holding an <svg> or a table, or an image). */
  html: string;
  /** Called with the new zoom percentage after every zoom change, for telemetry counts. */
  onZoom?: (percent: number) => void;
}

// ---- Calculator ----

/** What an engine saves so the calculator comes back as it was on the next question. Opaque to the app. */
export type CalculatorEngineState = unknown;

export interface CalculatorHandle {
  getState: () => CalculatorEngineState;
  /** Call after the panel is resized. */
  resize: () => void;
  destroy: () => void;
}

/**
 * The extension point for a real calculator. None is set up (docs/calculator-spec.md): the panel
 * then shows a plain message. An engine never receives question content.
 */
export interface CalculatorEngine {
  name: string;
  /** May throw or reject when the engine cannot load (offline, blocked); the panel then shows a message. */
  mount: (element: HTMLElement, mode: CalculatorMode, state: CalculatorEngineState | null) => Promise<CalculatorHandle>;
}

export interface CalculatorPanelProps {
  mode: CalculatorMode;
  onModeChange: (mode: CalculatorMode) => void;
  rect: PanelRect;
  onRectChange: (rect: PanelRect) => void;
  onClose: () => void;
  /** Null: no engine is set up. */
  engine: CalculatorEngine | null;
  /** Saved per mode, restored when the panel or mode comes back. */
  engineState: CalculatorEngineState | null;
  /** Called when an engine is unmounted, with the mode it was showing (on a switch, the old mode). */
  onEngineStateChange: (mode: CalculatorMode, state: CalculatorEngineState) => void;
}

// ---- Student-produced responses ----

/** The left pane on a student-produced response question: our own wording and the examples table. */
export interface SprDirectionsProps {
  /** Shown at the top. */
  heading?: string;
}

// ---- Highlights and notes, line reader ----

export interface HighlightToolbarProps {
  /** Viewport position to anchor the toolbar above. */
  anchor: { x: number; y: number };
  /** The style of the highlight being edited, or null for a fresh selection. */
  current: HighlightStyle | null;
  onStyle: (style: HighlightStyle) => void;
  /** Only for an existing highlight. */
  onDelete?: () => void;
  /** Opens the note editor. */
  onNote: () => void;
  onClose: () => void;
}

export interface NoteEditorProps {
  initial: string;
  /** Max characters (ANNOTATION_NOTE_MAX). */
  maxLength: number;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export interface LineReaderProps {
  /** Lines of text visible through the window. */
  lines: number;
  onClose: () => void;
}

// ---- Breaks and dialogs ----

export interface UnscheduledBreakProps {
  /** The clock keeps running during an unscheduled break. */
  remainingMs: number;
  onResume: () => void;
}

export interface InfoDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}
