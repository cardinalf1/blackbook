// "Copy diagnostics": version, platform, and the last lines of the logs. Keys, tokens, the user's
// home folder and any line that could hold question text are removed. The text goes to the
// clipboard only; nothing is sent anywhere.

import { redact } from '../../src/services/diagnostics/redact';

export interface DiagnosticsInput {
  version: string;
  platform: string;
  arch: string;
  osRelease: string;
  electron: string;
  /** Last lines of the program's and the shell's logs, newest last. */
  logLines: readonly string[];
  /** Extra facts, e.g. "sidecar: exited with code 1". */
  facts: readonly string[];
  secrets: readonly (string | null)[];
  home: string;
}

export const DIAGNOSTIC_LOG_LINES = 60;

/** Log lines never carry question text, but be strict anyway: long or HTML-looking lines are cut. */
function safeLine(line: string): string {
  if (/<[a-z][^>]*>/i.test(line)) return '[line removed: looked like page content]';
  return line.length > 300 ? `${line.slice(0, 300)} [cut]` : line;
}

export function buildDiagnostics(d: DiagnosticsInput): string {
  const lines = [
    'Blackbook diagnostics',
    `Version: ${d.version}`,
    `System: ${d.platform} ${d.arch} ${d.osRelease}`,
    `Electron: ${d.electron}`,
    ...d.facts,
    '',
    `Last ${Math.min(DIAGNOSTIC_LOG_LINES, d.logLines.length)} log lines:`,
    ...d.logLines.slice(-DIAGNOSTIC_LOG_LINES).map(safeLine),
  ];
  return redact(lines.join('\n'), { secrets: d.secrets, home: d.home });
}
