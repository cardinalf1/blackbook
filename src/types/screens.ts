// Contracts for the Phase 10 screens: first-run welcome, the "while you wait" panel, the question
// bank backup zip, Help and About. Screens stay thin: everything arrives through these props, and
// App wires them to the storage adapters and the desktop bridge.

/** The three first-run choices, in this order. */
export interface WelcomeScreenProps {
  /** Starts the two-stage download (opens the usual consent dialog first). */
  onDownload: () => void;
  /** Opens the import panel (bank zip or json). */
  onImport: () => void;
  /** Goes to Home with an empty bank; Help and Settings still work. */
  onLookAround: () => void;
  /** False when this build has downloading turned off; then only import and look around show. */
  downloadEnabled: boolean;
}

/** Shown while the download runs. Optional setup steps, plus a first drill once stage one lands. */
export interface WhileYouWaitProps {
  /** True once the live set is in the bank (stage one done). */
  stageOneReady: boolean;
  /** Questions available now (0 until stage one lands). */
  questionsReady: number;
  groqKeySaved: boolean;
  desmosKeySaved: boolean;
  /** Opens Settings at the key sections. */
  onOpenSettings: () => void;
  /** Starts a short drill (10 questions) from what is in the bank. Only offered when stageOneReady. */
  onStartFirstDrill: () => void;
  /** Opens a guide page in the default browser (desktop) or a new tab (dev). */
  onOpenGuide: (guide: 'groq' | 'desmos') => void;
}

export type BankBackupState =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  /** The browser or desktop save dialog took over; `canShowFile` when the desktop app can open its folder. */
  | { kind: 'exported'; canShowFile: boolean }
  | { kind: 'importing'; fileName: string; progress: number | null }
  | { kind: 'imported'; questions: number }
  | { kind: 'error'; message: string };

/** Export and import of the question-bank zip, on the Question bank screen. */
export interface BankBackupPanelProps {
  hasBank: boolean;
  questionCount: number;
  state: BankBackupState;
  onExport: () => void;
  /** A .zip backup or a plain question_bank.json. */
  onImport: (file: File) => void;
  /** Desktop only: open the folder of the file just saved. */
  onShowFile?: () => void;
}

/** Asked once after the first complete download. */
export interface SaveCopyPromptProps {
  questionCount: number;
  /** Starts the export (the save dialog defaults to Documents). */
  onSave: () => void;
  onNotNow: () => void;
}

export interface HelpScreenProps {
  /** True inside the desktop app (Quit and Open data folder exist there). */
  desktop: boolean;
  /** Where data lives on this computer, shown as text. */
  dataFolder: string | null;
  onOpenDataFolder?: () => void;
  /** Copies diagnostics to the clipboard; resolves false when that failed. */
  onCopyDiagnostics: () => Promise<boolean>;
  onOpenSettings: () => void;
  onBack: () => void;
}

export interface AboutScreenProps {
  version: string;
  /** Electron version, desktop only. */
  electron: string | null;
  platform: string | null;
  /** Opens THIRD_PARTY_LICENSES (shown in-app as plain text). */
  onOpenLicenses: () => void;
  onBack: () => void;
}
