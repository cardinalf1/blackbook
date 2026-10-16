// What the local program tells the page about itself (GET /api/info).

export interface AppStartupReport {
  /** The last run did not stop cleanly (a crash, a killed process or a power cut). */
  uncleanExit: boolean;
  integrity: 'ok' | 'failed' | 'not-checked';
  setAside: string | null;
  latestBackup: string | null;
  migrationBackup: string | null;
}

export interface AppInfo {
  dataFolder: string;
  downloadEnabled: boolean;
  version: string;
  /** True inside the desktop app; false under `bun run dev`. */
  desktop: boolean;
  startup: AppStartupReport | null;
}
