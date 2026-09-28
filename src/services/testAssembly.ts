import { QuestionRecord, ModuleRoute, SectionType } from '../types/sat';
import { dbAdapter } from './db';

/**
 * Shuffles an array in place
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Ensures we have at least `count` questions, cloning/modifying if pool is small
 */
function fillPool(pool: QuestionRecord[], count: number): QuestionRecord[] {
  if (pool.length === 0) return [];
  const result: QuestionRecord[] = [];
  let copyIndex = 0;
  while (result.length < count) {
    const item = pool[copyIndex % pool.length];
    if (copyIndex < pool.length) {
      result.push(item);
    } else {
      // Cloned variant with unique id
      result.push({
        ...item,
        id: `${item.id}-dup-${copyIndex}`,
      });
    }
    copyIndex++;
  }
  return result.slice(0, count);
}

/**
 * Assembles Reading and Writing Module (27 questions)
 * Module 1: 8 Easy, 13 Medium, 6 Hard
 * Quota: ~14 Craft & Structure / Info & Ideas (first cluster)
 *        ~13 Standard English Conventions / Expression of Ideas (second cluster)
 */
export async function assembleReadingWritingModule(
  stage: 'm1' | 'm2',
  route: ModuleRoute = 'Easy'
): Promise<QuestionRecord[]> {
  const allRW = await dbAdapter.getQuestionsByFilter('reading_writing');

  const craftAndInfo = allRW.filter(
    (q) => q.domain === 'Craft and Structure' || q.domain === 'Information and Ideas'
  );
  const secAndEoi = allRW.filter(
    (q) => q.domain === 'Standard English Conventions' || q.domain === 'Expression of Ideas'
  );

  let targetDistribution: { easy: number; med: number; hard: number };
  if (stage === 'm1') {
    // Official routing module: 8 Easy, 13 Medium, 6 Hard
    targetDistribution = { easy: 8, med: 13, hard: 6 };
  } else if (route === 'Hard') {
    // Hard Module 2: skewed higher difficulty
    targetDistribution = { easy: 2, med: 11, hard: 14 };
  } else {
    // Easy Module 2: skewed lower difficulty
    targetDistribution = { easy: 14, med: 11, hard: 2 };
  }

  // Split target counts between Cluster 1 (~14) and Cluster 2 (~13)
  const c1EasyTarget = Math.round((targetDistribution.easy * 14) / 27);
  const c1MedTarget = Math.round((targetDistribution.med * 14) / 27);
  const c1HardTarget = 14 - c1EasyTarget - c1MedTarget;

  const c2EasyTarget = targetDistribution.easy - c1EasyTarget;
  const c2MedTarget = targetDistribution.med - c1MedTarget;
  const c2HardTarget = targetDistribution.hard - c1HardTarget;

  // Pick Cluster 1 (Craft & Structure + Information & Ideas)
  const c1Easy = fillPool(craftAndInfo.filter(q => q.difficulty === 'Easy'), c1EasyTarget);
  const c1Med = fillPool(craftAndInfo.filter(q => q.difficulty === 'Medium'), c1MedTarget);
  const c1Hard = fillPool(craftAndInfo.filter(q => q.difficulty === 'Hard'), c1HardTarget);
  const cluster1 = shuffle([...c1Easy, ...c1Med, ...c1Hard]).slice(0, 14);

  // Pick Cluster 2 (Standard English Conventions + Expression of Ideas)
  const c2Easy = fillPool(secAndEoi.filter(q => q.difficulty === 'Easy'), c2EasyTarget);
  const c2Med = fillPool(secAndEoi.filter(q => q.difficulty === 'Medium'), c2MedTarget);
  const c2Hard = fillPool(secAndEoi.filter(q => q.difficulty === 'Hard'), c2HardTarget);
  const cluster2 = shuffle([...c2Easy, ...c2Med, ...c2Hard]).slice(0, 13);

  // Official College Board specification: Cluster 1 first, Cluster 2 second
  return [...cluster1, ...cluster2];
}

/**
 * Assembles Math Module (22 questions)
 * Module 1: 6 Easy, 11 Medium, 5 Hard
 * Domain quotas: ~8 Algebra, ~8 Advanced Math, ~3 Problem Solving, ~3 Geometry/Trig
 * Format: ~17 MCQ, ~5 SPR (SPR positioned at the end of the module in ascending difficulty)
 */
export async function assembleMathModule(
  stage: 'm1' | 'm2',
  route: ModuleRoute = 'Easy'
): Promise<QuestionRecord[]> {
  const allMath = await dbAdapter.getQuestionsByFilter('math');

  let targetDistribution: { easy: number; med: number; hard: number };
  if (stage === 'm1') {
    targetDistribution = { easy: 6, med: 11, hard: 5 };
  } else if (route === 'Hard') {
    targetDistribution = { easy: 2, med: 8, hard: 12 };
  } else {
    targetDistribution = { easy: 11, med: 9, hard: 2 };
  }

  // Filter pools by format and difficulty
  const mcqPool = allMath.filter(q => q.format === 'mcq');
  const sprPool = allMath.filter(q => q.format === 'spr');

  // Math module has ~17 MCQ and ~5 SPR
  const sprEasyTarget = Math.round((targetDistribution.easy * 5) / 22);
  const sprMedTarget = Math.round((targetDistribution.med * 5) / 22);
  const sprHardTarget = 5 - sprEasyTarget - sprMedTarget;

  const mcqEasyTarget = targetDistribution.easy - sprEasyTarget;
  const mcqMedTarget = targetDistribution.med - sprMedTarget;
  const mcqHardTarget = targetDistribution.hard - sprHardTarget;

  const mcqEasy = fillPool(mcqPool.filter(q => q.difficulty === 'Easy'), mcqEasyTarget);
  const mcqMed = fillPool(mcqPool.filter(q => q.difficulty === 'Medium'), mcqMedTarget);
  const mcqHard = fillPool(mcqPool.filter(q => q.difficulty === 'Hard'), mcqHardTarget);
  const assembledMcq = shuffle([...mcqEasy, ...mcqMed, ...mcqHard]).slice(0, 17);

  const sprEasy = fillPool(sprPool.filter(q => q.difficulty === 'Easy'), sprEasyTarget);
  const sprMed = fillPool(sprPool.filter(q => q.difficulty === 'Medium'), sprMedTarget);
  const sprHard = fillPool(sprPool.filter(q => q.difficulty === 'Hard'), sprHardTarget);

  // Order SPR in ascending difficulty (Easy -> Medium -> Hard)
  const assembledSpr = [
    ...shuffle(sprEasy),
    ...shuffle(sprMed),
    ...shuffle(sprHard),
  ].slice(0, 5);

  // MCQ questions first (1-17), SPR questions placed at end (18-22)
  return [...assembledMcq, ...assembledSpr];
}

/**
 * Checks whether user answers match correct answer key
 */
export function evaluateAnswer(userAnswer: string | undefined, correctAnswer: string, format: 'mcq' | 'spr'): boolean {
  if (!userAnswer || userAnswer.trim() === '') return false;

  if (format === 'mcq') {
    return userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
  }

  // SPR evaluation: numeric equivalence
  const cleanUser = userAnswer.trim();
  const cleanCorrect = correctAnswer.trim();

  if (cleanUser === cleanCorrect) return true;

  // Fraction evaluation (e.g. "3/4" vs "0.75")
  const parseVal = (str: string): number | null => {
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
      }
    }
    const val = parseFloat(str);
    return isNaN(val) ? null : val;
  };

  const userNum = parseVal(cleanUser);
  const correctNum = parseVal(cleanCorrect);

  if (userNum !== null && correctNum !== null) {
    return Math.abs(userNum - correctNum) < 1e-4;
  }

  return false;
}
