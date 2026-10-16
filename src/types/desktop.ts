// The few calls the desktop shell gives the page (electron/preload.ts). Absent in a plain browser
// (`bun run dev`), so every caller must handle `window.blackbookDesktop` being undefined.

export interface DesktopVersion {
  version: string;
  electron: string;
  platform: string;
  arch: string;
}

export interface DesktopUpdateStatus {
  /** The once-a-day check is allowed (Settings switch, on by default). */
  enabled: boolean;
  /** A newer release, when the last check found one. */
  latest: { version: string; url: string } | null;
  lastCheckedAt: number | null;
}

/** What the page tells the shell before it closes. */
export interface DesktopPageState {
  /** A timed module or test is running (the clock keeps going while the app is closed). */
  timedTestInProgress: boolean;
}

export type DesktopPage = 'help' | 'about';

export interface BlackbookDesktop {
  version(): Promise<DesktopVersion>;
  quit(): Promise<void>;
  openDataFolder(): Promise<void>;
  /** Opens the folder holding the last file saved through a download, with that file selected. */
  showLastDownload(): Promise<boolean>;
  /** Opens one of the allowed https pages (key setup help, the release page) in the default browser. */
  openExternal(url: string): Promise<boolean>;
  /** Copies diagnostics (version, platform, last log lines, scrubbed) to the clipboard. */
  copyDiagnostics(pageLines: readonly string[]): Promise<boolean>;
  updateStatus(): Promise<DesktopUpdateStatus>;
  setUpdateCheck(enabled: boolean): Promise<DesktopUpdateStatus>;
  /** Starts the local program again after it stopped (crash screen). */
  restartProgram(): Promise<void>;
  /** The shell asks before closing; the handler answers quickly. */
  onStateQuery(handler: () => DesktopPageState | Promise<DesktopPageState>): void;
  /** The shell asks the page to save everything before it closes. */
  onFlush(handler: () => Promise<void>): void;
  /** Menu: Help or About. */
  onNavigate(handler: (page: DesktopPage) => void): void;
}

declare global {
  interface Window {
    blackbookDesktop?: BlackbookDesktop;
  }
}
