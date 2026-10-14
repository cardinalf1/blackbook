// Talks to the local Blackbook server. The per-launch access token arrives once in the page URL
// (`?token=`); it is exchanged for an HttpOnly session cookie, kept in memory, and removed from
// the address bar so it never sits in browser history or gets copied with the link.

export class ApiError extends Error {
  constructor(
    /** HTTP status, or null when the local server could not be reached at all. */
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const SERVER_DOWN =
  "Blackbook's local program is not responding. If you closed it, start it again, then press Retry.";

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  /** Raw response, for streams. */
  raw(path: string, init?: RequestInit): Promise<Response>;
}

export function createApiClient(opts: { fetch: typeof fetch; baseUrl?: string; token?: () => string | null }): ApiClient {
  const base = opts.baseUrl ?? '';
  const raw = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    const token = opts.token?.() ?? null;
    if (token) headers.set('x-blackbook-token', token);
    if (init.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
    let res: Response;
    try {
      res = await opts.fetch(`${base}${path}`, { ...init, headers, credentials: 'same-origin' });
    } catch (e) {
      if (init.signal?.aborted) throw e;
      throw new ApiError(null, SERVER_DOWN);
    }
    return res;
  };
  return {
    raw,
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const res = await raw(path, init);
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text === '' ? null : (JSON.parse(text) as unknown);
      } catch {
        // A non-JSON error page means something between us and the server answered (e.g. the dev proxy).
        throw new ApiError(res.ok ? res.status : null, res.ok ? 'The local program sent an unreadable reply.' : SERVER_DOWN);
      }
      if (!res.ok) {
        const message = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : `Request failed (${res.status}).`;
        throw new ApiError(res.status, message);
      }
      return body as T;
    },
  };
}

// ---- The app-wide client ----

let token: string | null = null;
let ready: Promise<void> | null = null;

/**
 * Reads `?token=` once, swaps it for a session cookie, and strips it from the address bar.
 * Safe to call many times; later calls reuse the first result.
 */
export function initApiAuth(): Promise<void> {
  ready ??= (async () => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('token');
    if (fromUrl === null) return;
    token = fromUrl;
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    await api.request('/api/session', { method: 'POST', body: JSON.stringify({ token: fromUrl }) });
  })();
  return ready;
}

export const api: ApiClient = createApiClient({ fetch: (i, init) => fetch(i, init), token: () => token });
