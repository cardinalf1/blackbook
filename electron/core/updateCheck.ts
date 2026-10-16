// The update notice. At most once a day, and only while the Settings switch allows it (on by
// default, disclosed in Settings, Help and docs/network.md), ask GitHub's public API for the
// latest release of this repository. No token, no data besides the request itself. A newer
// version shows a banner whose button opens the release page in the browser. Nothing is
// downloaded or installed.

export const RELEASES_REPO = 'cardinalf1/blackbook';
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases`;
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

export interface UpdateInfo {
  version: string;
  url: string;
}

/** -1, 0 or 1. Plain x.y.z with an optional -suffix (a suffix sorts before the release). */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
    if (!m) return null;
    return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
  };
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] as number) - (y.nums[i] as number);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre > y.pre ? 1 : -1;
}

export function isDue(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= CHECK_EVERY_MS || now < lastCheckedAt;
}

/** The newer release from a GitHub "latest release" reply, or null. Only github.com release pages are trusted as links. */
export function parseLatestRelease(body: unknown, current: string): UpdateInfo | null {
  if (typeof body !== 'object' || body === null) return null;
  const r = body as { tag_name?: unknown; html_url?: unknown; draft?: unknown; prerelease?: unknown };
  if (typeof r.tag_name !== 'string' || r.draft === true || r.prerelease === true) return null;
  const version = r.tag_name.replace(/^v/, '');
  if (compareVersions(version, current) <= 0) return null;
  const url = typeof r.html_url === 'string' && r.html_url.startsWith(`https://github.com/${RELEASES_REPO}/releases/`) ? r.html_url : RELEASES_PAGE;
  return { version, url };
}

/** One request to GitHub. Any failure (offline, rate limit, odd reply) means "no notice". */
export async function fetchLatest(fetchFn: typeof fetch, current: string, timeoutMs = 10_000): Promise<UpdateInfo | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Blackbook/${current}` },
      signal: ctl.signal,
      credentials: 'omit',
    });
    if (!res.ok) return null;
    return parseLatestRelease((await res.json()) as unknown, current);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
