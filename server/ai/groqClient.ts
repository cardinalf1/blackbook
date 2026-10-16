// One Groq chat call with a strict JSON schema. Returns the parsed JSON or a failure kind; never
// throws, never logs, and never puts the key in what it returns.

import { AI_MAX_COMPLETION_TOKENS, AI_MAX_RETRIES, AI_RETRY_AFTER_CAP_MS, AI_TEMPERATURE, AI_TIMEOUT_MS, GROQ_CHAT_URL } from '../../src/config/aiConfig';
import type { AiFailure } from '../../src/types/ai';

export interface ChatRequest {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

export type ChatResult = { ok: true; json: unknown } | { ok: false; failure: AiFailure; message: string };

export interface GroqDeps {
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

/** The exact body sent to Groq, minus the authorization header. Also what the preview shows. */
export function requestBody(r: ChatRequest): Record<string, unknown> {
  return {
    model: r.model,
    temperature: AI_TEMPERATURE,
    max_completion_tokens: AI_MAX_COMPLETION_TOKENS,
    response_format: { type: 'json_schema', json_schema: { name: r.schemaName, strict: true, schema: r.schema } },
    messages: [
      { role: 'system', content: r.system },
      { role: 'user', content: r.user },
    ],
  };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function chat(key: string, r: ChatRequest, deps: GroqDeps): Promise<ChatResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const body = JSON.stringify(requestBody(r));
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? AI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body,
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (ctl.signal.aborted) return { ok: false, failure: 'timeout', message: 'Groq did not answer in time.' };
      return { ok: false, failure: 'network', message: `Could not reach Groq${e instanceof Error && e.name === 'TypeError' ? ' (no connection?)' : ''}.` };
    }
    clearTimeout(timer);
    if (res.status === 429) {
      if (attempt < AI_MAX_RETRIES) {
        const after = Number(res.headers.get('retry-after') ?? '2');
        await sleep(Math.min(AI_RETRY_AFTER_CAP_MS, Math.max(500, (Number.isFinite(after) ? after : 2) * 1000)));
        continue;
      }
      return { ok: false, failure: 'rate_limited', message: 'Groq rate limit reached. Try again in a minute.' };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, failure: 'http', message: 'Groq refused the key. Check it in Settings.' };
    if (!res.ok) return { ok: false, failure: 'http', message: `Groq answered with an error (${res.status}).` };
    let parsed: unknown;
    try {
      parsed = (await res.json()) as unknown;
    } catch {
      return { ok: false, failure: 'invalid_reply', message: 'Groq sent an unreadable reply.' };
    }
    const content = (parsed as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { ok: false, failure: 'invalid_reply', message: 'Groq sent no answer.' };
    try {
      return { ok: true, json: JSON.parse(content) as unknown };
    } catch {
      return { ok: false, failure: 'invalid_reply', message: 'Groq sent an answer that is not valid JSON.' };
    }
  }
}
