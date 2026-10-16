// Backup and restore of user data (Phase 6). A snapshot is the same JSON as "Export my data"; it
// never holds the question bank (it can be downloaded again) and never an API key.

export interface BackupInfo {
  /** File name inside the backups folder, e.g. blackbook-2026-10-16.json. */
  name: string;
  /** When the snapshot was written, epoch ms. */
  at: number;
  sizeBytes: number;
  /** Rolling daily snapshot, a safety copy taken just before a restore or a delete, or the one written when the app closed. */
  kind: 'daily' | 'before_restore' | 'before_delete' | 'on_exit';
}

export interface BackupList {
  backups: BackupInfo[];
  /** Newest snapshot of any kind, or null when there is none. */
  lastBackupAt: number | null;
}

/** What a restore put in place. The Data page shows these so the user can check them. */
export interface RestoreResult {
  sessions: number;
  attempts: number;
  events: number;
  mistakeTags: number;
}

/** Backups as UI code sees them (AGENTS.md rule 6). */
export interface BackupStore {
  list(): Promise<BackupList>;
  /** Replaces current progress with the snapshot. A safety copy of the current data is written first. */
  restoreSnapshot(name: string): Promise<RestoreResult>;
  /** Replaces current progress with an export file's contents. A safety copy is written first. */
  restoreExport(data: unknown): Promise<RestoreResult>;
}
