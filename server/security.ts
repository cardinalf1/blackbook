// Guards for the local API. Any website the user visits can send requests to 127.0.0.1, so:
// - Host must be our own address (blocks DNS rebinding),
// - Origin, when present, must be the app's own origin (blocks cross-site requests),
// - every request must carry the per-launch token, as a header or as the session cookie that
//   the app gets once from the first-load URL.

import { timingSafeEqual } from 'node:crypto';

export const TOKEN_HEADER = 'x-blackbook-token';
export const SESSION_COOKIE = 'bb_session';

/** The cookie name carries the port, so two Blackbook programs on one computer never mix sessions. */
export function cookieNameForPort(port: number): string {
  return `${SESSION_COOKIE}_${port}`;
}

export interface SecurityConfig {
  token: string;
  /** Session cookie name; SESSION_COOKIE when absent. */
  cookieName?: string;
  allowedHosts: ReadonlySet<string>;
  allowedOrigins: ReadonlySet<string>;
}

export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export type GuardResult = { ok: true } | { ok: false; status: 401 | 403; message: string };

/** Host and Origin checks only. Used for the token exchange, which cannot have the token yet. */
export function checkHostAndOrigin(req: Request, cfg: SecurityConfig): GuardResult {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (!cfg.allowedHosts.has(host)) return { ok: false, status: 403, message: 'Unexpected Host header.' };
  const origin = req.headers.get('origin');
  if (origin !== null && !cfg.allowedOrigins.has(origin)) return { ok: false, status: 403, message: 'Cross-origin requests are not allowed.' };
  return { ok: true };
}

export function checkRequest(req: Request, cfg: SecurityConfig): GuardResult {
  const base = checkHostAndOrigin(req, cfg);
  if (!base.ok) return base;
  const presented = req.headers.get(TOKEN_HEADER) ?? cookieValue(req.headers.get('cookie'), cfg.cookieName ?? SESSION_COOKIE);
  if (presented === null || !sameSecret(presented, cfg.token)) {
    return { ok: false, status: 401, message: 'Missing or wrong access key. Open Blackbook again from its launch link.' };
  }
  return { ok: true };
}

export function sessionCookie(token: string, name = SESSION_COOKIE): string {
  // HttpOnly: page scripts cannot read it. SameSite=Strict: never sent on requests from other sites.
  // No Max-Age: it ends when the browser closes, and a new launch has a new token anyway.
  return `${name}=${token}; Path=/api; HttpOnly; SameSite=Strict`;
}
