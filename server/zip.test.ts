// The backup zip format: round trip, checksum and count checks, and refusal of anything damaged.
// Synthetic questions only.

import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { syntheticQuestions } from '../src/services/__fixtures__/synthetic';
import type { Question } from '../src/types/sat';
import { bankZipName, buildBankZip, countBank, readBankZip } from './bankZip';
import { crc32, readZip, writeZip, ZipError } from './zip';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips entries', () => {
    const files = readZip(writeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: 'b.json', data: new Uint8Array(70000).fill(65) }]));
    expect(new TextDecoder().decode(files.get('a.txt'))).toBe('hello');
    expect(files.get('b.json')?.length).toBe(70000);
  });

  it('refuses password-protected, oversized and truncated zips', () => {
    const good = writeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello world') }]);
    const locked = good.slice();
    // general-purpose flag in the central directory entry
    const cd = locked.length - 22 - (46 + 5);
    locked[cd + 8] = (locked[cd + 8] as number) | 1;
    expect(() => readZip(locked)).toThrow(/password/);
    expect(() => readZip(good, 4)).toThrow(ZipError);
    expect(() => readZip(good.slice(0, good.length - 30))).toThrow(ZipError);
    expect(deflateRawSync(Buffer.from('x')).length).toBeGreaterThan(0);
  });
});

describe('question bank zip', () => {
  const base = syntheticQuestions[0] as Question;
  const q = (over: Partial<Question>): Question => ({ ...base, ...over });
  const questions = [
    q({ id: 'r1', section: 'rw', difficulty: 'E', active: true }),
    q({ id: 'r2', section: 'rw', difficulty: 'H', active: false }),
    q({ id: 'm1', section: 'math', difficulty: 'M', active: true }),
  ];
  const now = new Date(2026, 9, 16, 12, 0, 0);

  it('names the file by date and writes counts and a checksum into the manifest', () => {
    expect(bankZipName(now)).toBe('Blackbook-QuestionBank-2026-10-16.zip');
    const z = buildBankZip({ questions, skipped: [], fetchedAt: '2026-10-01T00:00:00Z' }, '1.0.0', now);
    expect(z.manifest.counts).toEqual(countBank(questions));
    expect(z.manifest.counts).toMatchObject({ total: 3, live: 2, bySection: { rw: 2, math: 1 }, byDifficulty: { E: 1, M: 1, H: 1 } });
    expect(z.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    const back = readBankZip(z.bytes);
    expect(back.ok).toBe(true);
    if (back.ok) expect((JSON.parse(back.text) as { questions: unknown[] }).questions).toHaveLength(3);
  });

  it('refuses a zip whose bank does not match the manifest', () => {
    const z = buildBankZip({ questions, skipped: [], fetchedAt: 'f' }, '1.0.0', now);
    const files = readZip(z.bytes);
    const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json'))) as { sha256: string; counts: { total: number } };
    const tampered = writeZip([
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ ...manifest, sha256: '0'.repeat(64) })) },
      { name: 'question_bank.json', data: files.get('question_bank.json') as Uint8Array },
    ]);
    expect(readBankZip(tampered)).toMatchObject({ ok: false, error: expect.stringMatching(/checksum/) as unknown });
    const recount = writeZip([
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify({ ...manifest, counts: { ...manifest.counts, total: 99 } })) },
      { name: 'question_bank.json', data: files.get('question_bank.json') as Uint8Array },
    ]);
    expect(readBankZip(recount)).toMatchObject({ ok: false, error: expect.stringMatching(/number of questions/) as unknown });
  });

  it('refuses a foreign zip and a non-zip', () => {
    expect(readBankZip(writeZip([{ name: 'other.txt', data: new Uint8Array([1]) }]))).toMatchObject({ ok: false });
    expect(readBankZip(new TextEncoder().encode('{"not":"zip"}'))).toMatchObject({ ok: false, error: 'That file is not a zip file.' });
  });
});
