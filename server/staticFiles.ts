// Serves the built page (the Vite `dist` folder) in the desktop app, with a strict
// Content-Security-Policy and the usual security headers. Unknown paths without a file extension
// get index.html so the app can show its own "not found" screen.
//
// CSP: only the app's own origin. Question pictures are inline data: URIs and styles come inline
// from question markup and KaTeX, hence data: images and 'unsafe-inline' styles. Desmos is NOT
// allowed here: it runs only inside its own sandboxed frame page, whose separate policy names
// Desmos's hosts and which exists only while a Desmos key is saved (server/calculator.ts).

import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Headers on every response from the local program (API, page and files). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=()',
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

export function withSecurityHeaders(res: Response): Response {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v);
  return res;
}

/** Resolves a URL path inside `root`, or null when it would leave the folder. */
export function safePath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = resolve(root);
  const full = resolve(base, normalize(`.${decoded.startsWith('/') ? decoded : `/${decoded}`}`));
  return full === base || full.startsWith(base + sep) ? full : null;
}

export function createStaticHandler(root: string): (path: string, method: string) => Promise<Response> {
  const page = async (status = 200) =>
    new Response(await readFile(join(root, 'index.html')), {
      status,
      headers: { 'content-type': TYPES['.html'] as string, 'cache-control': 'no-store', 'content-security-policy': APP_CSP },
    });
  return async (path, method) => {
    if (method !== 'GET' && method !== 'HEAD') return new Response('Method not allowed.', { status: 405 });
    if (path === '/' || path === '/index.html') return page();
    const file = safePath(root, path);
    if (file === null) return new Response('Not found.', { status: 404 });
    try {
      const st = await stat(file);
      if (st.isFile()) {
        const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
        // Vite puts a content hash in asset names, so they can be cached for good.
        const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
        return new Response(await readFile(file), { headers: { 'content-type': type, 'cache-control': cache, 'content-security-policy': APP_CSP } });
      }
    } catch {
      // fall through
    }
    // A path that looks like a file but is missing is a real 404; anything else is an app route.
    if (extname(path) !== '') return new Response('Not found.', { status: 404 });
    return page();
  };
}
