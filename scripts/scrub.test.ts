import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Repo Hygiene & Scrub Verification (Step 8)', () => {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.includes('bun.lock'));

  it('no tracked file contains developer username or local user profile paths', () => {
    // Check for developer username or user profiles like C:\Users\<name>
    const developerRegex = /(?:[A-Za-z]:[\\\/]Users[\\\/]Raghav|\/Users\/Raghav|\/home\/Raghav)/i;
    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of trackedFiles) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.woff2') || file.endsWith('.ico')) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i]?.match(developerRegex);
        if (match) {
          violations.push({ file, line: i + 1, match: match[0] });
        }
      }
    }

    expect(violations, 'Developer user profile paths found in tracked files').toEqual([]);
  });

  it('no tracked file contains personal emails', () => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@(?!example\.com|github\.com|users\.noreply\.github\.com|collegeboard\.org|desmos\.com|groq\.com)[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const violations: { file: string; match: string }[] = [];

    for (const file of trackedFiles) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.woff2') || file.endsWith('.ico')) continue;
      // Third-party open source licenses legitimately contain author emails in copyright notices
      if (file === 'THIRD_PARTY_LICENSES.md') continue;
      const content = readFileSync(file, 'utf8');
      const match = content.match(emailRegex);
      if (match) {
        violations.push({ file, match: match[0] });
      }
    }

    expect(violations, 'Personal email addresses found in tracked files').toEqual([]);
  });

  it('no tracked file contains real live 50+ char Groq API keys', () => {
    const keyRegex = /gsk_[a-zA-Z0-9]{45,}/;
    const violations: { file: string; match: string }[] = [];

    for (const file of trackedFiles) {
      const content = readFileSync(file, 'utf8');
      const match = content.match(keyRegex);
      if (match) {
        violations.push({ file, match: match[0] });
      }
    }

    expect(violations, 'Live API keys found in tracked files').toEqual([]);
  });
});
