// Browser side of the download: start, cancel, free the cache, and follow the progress stream.
// The stream is read with fetch (not EventSource) so it carries the same access checks as every
// other request.

import type { DownloadProgress, DownloadScopeChoice } from '../../types/download';
import { api, type ApiClient } from '../api/client';

export interface DownloadClient {
  start(scope: DownloadScopeChoice): Promise<DownloadProgress>;
  cancel(): Promise<void>;
  freeCache(): Promise<DownloadProgress>;
  snapshot(): Promise<DownloadProgress>;
  /**
   * Calls `onProgress` with every snapshot until the returned function is called. Reconnects on
   * its own after the server restarts; `onConnection` reports whether the stream is up.
   */
  follow(onProgress: (p: DownloadProgress) => void, onConnection?: (up: boolean) => void): () => void;
}

/** Splits a server-sent-events byte stream into `data:` payloads. Comments (pings) are skipped. */
export function parseEvents(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const data = part
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6))
      .join('\n');
    if (data !== '') events.push(data);
  }
  return { events, rest };
}

export function createDownloadClient(client: ApiClient = api, reconnectMs = 2000): DownloadClient {
  return {
    start: (scope) => client.request<DownloadProgress>('/api/download/start', { method: 'POST', body: JSON.stringify(scope) }),
    cancel: async () => {
      await client.request('/api/download/cancel', { method: 'POST' });
    },
    freeCache: () => client.request<DownloadProgress>('/api/download/free-cache', { method: 'POST' }),
    snapshot: () => client.request<DownloadProgress>('/api/download'),
    follow(onProgress, onConnection) {
      let stopped = false;
      let ctl: AbortController | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const loop = async () => {
        while (!stopped) {
          ctl = new AbortController();
          try {
            const res = await client.raw('/api/download/events', { signal: ctl.signal });
            if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
            onConnection?.(true);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              const parsed = parseEvents(buffer + decoder.decode(value, { stream: true }));
              buffer = parsed.rest;
              for (const e of parsed.events) onProgress(JSON.parse(e) as DownloadProgress);
            }
          } catch {
            // dropped or refused: fall through to reconnect
          }
          if (stopped) return;
          onConnection?.(false);
          await new Promise<void>((r) => {
            timer = setTimeout(r, reconnectMs);
          });
        }
      };
      void loop();
      return () => {
        stopped = true;
        ctl?.abort();
        if (timer !== null) clearTimeout(timer);
      };
    },
  };
}

export const downloads = createDownloadClient();
