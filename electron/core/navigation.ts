// Where the app window may go. The window only ever shows the local program's own pages (and the
// crash page the shell writes itself). Links to a short list of https sites (setup help for keys, the release
// page) open in the user's default browser; everything else is refused.

/** Sites the app links to. Matched on exact host, https only. */
export const EXTERNAL_HOSTS: readonly string[] = [
  'console.groq.com',
  'groq.com',
  'www.desmos.com',
  'desmos.com',
  'github.com',
];

export function isAppUrl(url: string, appOrigin: string | null): boolean {
  if (appOrigin === null) return false;
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

/** True for an https link to one of EXTERNAL_HOSTS (no credentials in the URL). */
export function isAllowedExternal(url: string, hosts: readonly string[] = EXTERNAL_HOSTS): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '') return false;
  return hosts.includes(u.hostname.toLowerCase());
}

export type NavigationDecision = 'allow' | 'external' | 'deny';

/** What to do when the page tries to navigate or open a window. */
export function decideNavigation(url: string, appOrigin: string | null): NavigationDecision {
  if (isAppUrl(url, appOrigin)) return 'allow';
  if (isAllowedExternal(url)) return 'external';
  return 'deny';
}

/**
 * Requests the window's session may make. The page talks only to the local program; the Desmos
 * frame (served by the local program) loads Desmos's own script and data. Nothing else.
 */
export function isAllowedRequest(url: string, appOrigin: string | null): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'devtools:' || u.protocol === 'chrome-extension:') return true;
  if (appOrigin !== null && u.origin === appOrigin) return true;
  if (u.protocol === 'https:' && (u.hostname === 'www.desmos.com' || u.hostname === 'desmos.com' || u.hostname.endsWith('.desmos.com'))) return true;
  return false;
}
