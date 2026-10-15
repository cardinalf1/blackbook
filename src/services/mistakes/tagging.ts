// Saves one mistake tag: appends the row and logs the matching event. The note the user types goes
// into the stored row only; events carry the ids and the reason, never the note and never question text.

import { MISTAKE_NOTE_MAX, type MistakeReason, type MistakeStore, type MistakeTag } from '../../types/mistakes';
import type { SessionMode } from '../../types/session';
import type { EventLogger } from '../telemetry/logger';

export interface TagInput {
  sessionId: string;
  questionId: string;
  mode: SessionMode;
  reason: MistakeReason;
  note: string;
  /** True when the user confirmed the app's suggestion without changing it. */
  suggested: boolean;
  /** The tag in force before this one, or null. */
  previous: MistakeTag | null;
}

export interface TagDeps {
  store: MistakeStore;
  telemetry?: Pick<EventLogger, 'log'>;
  now?: () => number;
  newId?: () => string;
}

export async function saveMistakeTag(input: TagInput, deps: TagDeps): Promise<MistakeTag> {
  const tag: MistakeTag = {
    id: (deps.newId ?? (() => crypto.randomUUID()))(),
    sessionId: input.sessionId,
    questionId: input.questionId,
    reason: input.reason,
    note: input.note.trim().slice(0, MISTAKE_NOTE_MAX),
    suggested: input.suggested,
    at: (deps.now ?? Date.now)(),
  };
  await deps.store.addTag(tag);
  const ctx = { sessionId: tag.sessionId, mode: input.mode, questionId: tag.questionId };
  if (!input.previous) deps.telemetry?.log('mistake_tag_set', ctx, { reason: tag.reason, suggested: tag.suggested });
  else if (input.previous.reason !== tag.reason) deps.telemetry?.log('mistake_tag_changed', ctx, { from: input.previous.reason, to: tag.reason });
  return tag;
}
