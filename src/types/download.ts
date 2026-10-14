// Contracts for the in-app download (local server side and UI). Screens are built against these.

import type { ReactNode } from 'react';
import type { Section } from './sat';

/** What the user chose to download. Live set first is the default. */
export interface DownloadScopeChoice {
  sections: Section[];
  liveOnly: boolean;
}

export const DEFAULT_SCOPE: DownloadScopeChoice = { sections: ['rw', 'math'], liveOnly: true };

export type DownloadStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type DownloadStage = 'lists' | 'details' | 'normalize' | 'saving';
export type DownloadFailureReason = 'blocked' | 'offline' | 'failures' | 'stalled' | 'shape' | 'storage' | 'error';

/** Rough size of a fresh download for a scope. Shown in the consent dialog. */
export interface DownloadEstimate {
  questions: number;
  requests: number;
  minutes: number;
}

/** One line of the plain-language skip report. */
export interface SkipLine {
  reason: string;
  count: number;
  description: string;
}

export interface DownloadSummary {
  questions: number;
  bySection: Partial<Record<Section, number>>;
  live: number;
  skipped: SkipLine[];
  durationMs: number;
}

/** Snapshot sent by the local server on every change, and on request. */
export interface DownloadProgress {
  status: DownloadStatus;
  scope: DownloadScopeChoice | null;
  stage: DownloadStage | null;
  /** Questions in scope. */
  questions: number;
  /** Details already cached from an earlier run, not refetched. */
  cached: number;
  /** Details to fetch in this run. */
  toFetch: number;
  fetched: number;
  failed: number;
  retries: number;
  normalized: number;
  startedAt: number | null;
  /** Server time of this snapshot, epoch ms. */
  updatedAt: number;
  /** Rough seconds left, null when unknown. */
  etaSeconds: number | null;
  error: { reason: DownloadFailureReason; message: string; lastRequest: string | null } | null;
  summary: DownloadSummary | null;
  /** Raw download cache on disk, which can be freed after a successful run. */
  cache: { bytes: number; files: number };
  /** Folder where this computer keeps the bank and progress. */
  dataFolder: string;
}

// ---- Props contracts. Screens stay thin: all logic arrives through these props. ----

/** Empty-bank screen (primary: download) and, when a bank exists, the Refresh action. */
export interface DownloadStartProps {
  hasBank: boolean;
  questionCount: number;
  estimate: (scope: DownloadScopeChoice) => DownloadEstimate;
  /** Opens the consent dialog for this scope. */
  onChoose: (scope: DownloadScopeChoice) => void;
  /** The existing file-import panel, shown as the secondary option. */
  importSlot: ReactNode;
}

export interface DownloadConsentProps {
  scope: DownloadScopeChoice;
  estimate: DownloadEstimate;
  dataFolder: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface DownloadProgressPanelProps {
  progress: DownloadProgress;
  onCancel: () => void;
  /** Starts the same scope again; it resumes from the cache. */
  onRetry: () => void;
  onClose: () => void;
  onFreeCache: () => void;
}
