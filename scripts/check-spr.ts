// Grades every accepted answer in data/question_bank.json against its own question and prints the
// forms found. Run: bun run scripts/check-spr.ts. Exits 1 if any listed answer is rejected.

import { readFileSync } from 'node:fs';
import { isSprCorrect } from '../src/services/answers';
import { validateBank } from '../src/services/bank/validate';

const raw: unknown = JSON.parse(readFileSync('data/question_bank.json', 'utf8'));
const v = validateBank(raw);
if (!v.ok) {
  console.error(`Not a valid bank: ${v.errors.join('; ')}`);
  process.exit(1);
}

const forms = { integer: 0, decimal: 0, fraction: 0, other: 0 };
let questions = 0;
let multi = 0;
const failures: string[] = [];

for (const q of v.value.questions) {
  if (q.answer.kind !== 'spr') continue;
  questions++;
  if (q.answer.accepted.length > 1) multi++;
  for (const a of q.answer.accepted) {
    if (/^-?\d+$/.test(a)) forms.integer++;
    else if (/^-?(\d+\.\d+|\.\d+)$/.test(a)) forms.decimal++;
    else if (/^-?\d+\/\d+$/.test(a)) forms.fraction++;
    else forms.other++;
    // Each listed form must grade correct, and so must its leading-zero / unicode-minus variants.
    const variants = [a, a.startsWith('.') ? `0${a}` : a, a.startsWith('-') ? a.replace('-', '−') : a];
    for (const input of variants) {
      if (!isSprCorrect(input, q.answer.accepted)) failures.push(`${q.displayId}: ${JSON.stringify(input)} rejected`);
    }
  }
}

console.log(`SPR questions: ${questions} (${multi} with more than one accepted answer)`);
console.log(`Accepted strings by form: ${JSON.stringify(forms)}`);
if (failures.length > 0) {
  console.error(`${failures.length} listed answers were rejected:\n${failures.slice(0, 20).join('\n')}`);
  process.exit(1);
}
console.log('Every listed answer, and its leading-zero and unicode-minus variants, grades correct.');
