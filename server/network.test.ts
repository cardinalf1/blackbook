import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ALLOWED_DOMAINS = new Set([
  '127.0.0.1',
  'localhost',
  'api.collegeboard.org',
  'questionbank.collegeboard.org',
  'api.groq.com',
  'www.desmos.com',
  'api.github.com',
  'github.com',
  'www.w3.org', // SVG namespace
]);

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'release') {
        yield* walk(full);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield full;
    }
  }
}

describe('Network Egress Policy Verification (Step 3)', () => {
  it('every external URL in production code is in the approved egress allowlist', async () => {
    const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+)(?::[0-9]+)?/g;
    const violations: { file: string; host: string }[] = [];

    const dirsToScan = ['src', 'server', 'electron'];
    for (const dir of dirsToScan) {
      for await (const file of walk(dir)) {
        if (file.includes('.test.') || file.includes('__fixtures__')) continue;
        const content = await readFile(file, 'utf8');
        let match;
        while ((match = urlRegex.exec(content)) !== null) {
          const host = match[1]?.toLowerCase();
          if (host && !ALLOWED_DOMAINS.has(host) && !host.endsWith('.collegeboard.org') && !host.endsWith('.desmos.com')) {
            violations.push({ file, host });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
