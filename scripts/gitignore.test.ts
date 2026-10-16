import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('.gitignore Verification (Step 8)', () => {
  const sensitivePaths = [
    'data/question_bank.json',
    'data/app/bank.json',
    'sidecar/blackbook-server.exe',
    'release/Blackbook-Setup-1.0.0.exe',
    'release/SHA256SUMS.txt',
    'out/main.cjs',
    'dist/index.html',
    '.env',
    '.env.local',
    'secrets/key.bin',
    'user.db',
    'test.sqlite',
    'backup.zip',
    'archive.tar.gz',
    'docs/research/notes.md',
    'handoff/screens/shot.png',
  ];

  it('all sensitive files and build artifacts are ignored by git', () => {
    for (const p of sensitivePaths) {
      const res = spawnSync('git', ['check-ignore', p], { encoding: 'utf8' });
      expect(res.status, `Expected ${p} to be git-ignored`).toBe(0);
      expect(res.stdout.trim()).toBe(p);
    }
  });

  it('source files are NOT ignored by git', () => {
    const safePaths = [
      'src/App.tsx',
      'server/main.ts',
      'electron/main.ts',
      'package.json',
      'README.md',
    ];
    for (const p of safePaths) {
      const res = spawnSync('git', ['check-ignore', p], { encoding: 'utf8' });
      expect(res.status, `Expected ${p} NOT to be git-ignored`).toBe(1);
    }
  });
});
