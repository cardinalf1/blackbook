// Scrubs text before it reaches a log file or "Copy diagnostics": API keys (Groq keys start with
// gsk_; any `apiKey=`/`key=` value in a URL), the user's home folder and user name in paths, and
// anything listed in `secrets` (the saved keys themselves). Used by the local server, the desktop
// shell and the page, so every place that writes diagnostics scrubs the same way.

const GROQ_KEY = /gsk_[A-Za-z0-9_-]{8,}/g;
const URL_KEY = /([?&](?:api[_-]?key|key|token)=)[^&\s"'#]+/gi;
const BEARER = /(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const TOKEN_HEADER = /(x-blackbook-token["']?\s*[:=]\s*["']?)[A-Za-z0-9_-]{8,}/gi;
const WIN_HOME = /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+/gi;
const MAC_HOME = /\/Users\/[^/\s"']+/g;
const LINUX_HOME = /\/home\/[^/\s"']+/g;

export interface RedactOptions {
  /** Exact secrets to remove wherever they appear (the saved keys, the launch token). */
  secrets?: readonly (string | null | undefined)[];
  /** The home folder, replaced by ~ (it usually holds the user name). */
  home?: string | null;
}

export function redact(text: string, opts: RedactOptions = {}): string {
  let out = text;
  for (const s of opts.secrets ?? []) if (s && s.length >= 4) out = out.split(s).join('[removed]');
  if (opts.home && opts.home.length > 3) {
    out = out.split(opts.home).join('~');
    out = out.split(opts.home.replace(/\\/g, '/')).join('~');
  }
  return out
    .replace(GROQ_KEY, '[key removed]')
    .replace(URL_KEY, '$1[removed]')
    .replace(BEARER, '$1[removed]')
    .replace(TOKEN_HEADER, '$1[removed]')
    .replace(WIN_HOME, '~')
    .replace(MAC_HOME, '~')
    .replace(LINUX_HOME, '~');
}
