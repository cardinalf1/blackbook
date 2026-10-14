import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Difficulty, Question, Section } from '../../types/sat';
import { matchesQuery, type BankMeta, type ProgressFn, type QuestionQuery, type QuestionStore } from './types';

const DB_NAME = 'blackbook';
const DB_VERSION = 1;
const META_KEY = 'bank';
const PROGRESS_EVERY = 200;

interface BlackbookDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: {
      section: Section;
      skillCode: string;
      section_difficulty: [Section, Difficulty];
      skillCode_difficulty: [string, Difficulty];
    };
  };
  meta: {
    key: string;
    value: BankMeta & { key: string };
  };
}

export class IndexedDbQuestionStore implements QuestionStore {
  private db: Promise<IDBPDatabase<BlackbookDB>> | null = null;

  private open(): Promise<IDBPDatabase<BlackbookDB>> {
    this.db ??= openDB<BlackbookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const qs = db.createObjectStore('questions', { keyPath: 'id' });
        qs.createIndex('section', 'section');
        qs.createIndex('skillCode', 'skillCode');
        qs.createIndex('section_difficulty', ['section', 'difficulty']);
        qs.createIndex('skillCode_difficulty', ['skillCode', 'difficulty']);
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    return this.db;
  }

  async replaceAll(questions: readonly Question[], meta: BankMeta, onProgress?: ProgressFn): Promise<void> {
    const db = await this.open();
    // One transaction: if anything fails, IndexedDB rolls back and the old bank remains.
    const tx = db.transaction(['questions', 'meta'], 'readwrite');
    const qs = tx.objectStore('questions');
    await qs.clear();
    for (let i = 0; i < questions.length; i++) {
      await qs.put(questions[i] as Question);
      if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === questions.length) onProgress?.(i + 1, questions.length);
    }
    await tx.objectStore('meta').put({ ...meta, key: META_KEY });
    await tx.done;
  }

  async count(): Promise<number> {
    return (await this.open()).count('questions');
  }

  async get(id: string): Promise<Question | undefined> {
    return (await this.open()).get('questions', id);
  }

  async query(query: QuestionQuery): Promise<Question[]> {
    const db = await this.open();
    let candidates: Question[];
    if (query.skillCode !== undefined && query.difficulty !== undefined) {
      candidates = await db.getAllFromIndex('questions', 'skillCode_difficulty', [query.skillCode, query.difficulty]);
    } else if (query.skillCode !== undefined) {
      candidates = await db.getAllFromIndex('questions', 'skillCode', query.skillCode);
    } else if (query.section !== undefined && query.difficulty !== undefined) {
      candidates = await db.getAllFromIndex('questions', 'section_difficulty', [query.section, query.difficulty]);
    } else if (query.section !== undefined) {
      candidates = await db.getAllFromIndex('questions', 'section', query.section);
    } else {
      candidates = await db.getAll('questions');
    }
    return candidates.filter((q) => matchesQuery(q, query));
  }

  async getMeta(): Promise<BankMeta | null> {
    const row = await (await this.open()).get('meta', META_KEY);
    if (row === undefined) return null;
    const { key: _key, ...meta } = row;
    return meta;
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(['questions', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('questions').clear(), tx.objectStore('meta').clear(), tx.done]);
  }
}
