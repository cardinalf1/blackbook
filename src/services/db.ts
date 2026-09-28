import { openDB, IDBPDatabase } from 'idb';
import { QuestionRecord, SessionRecord, SectionType, DifficultyLevel } from '../types/sat';
import { generateFullCalibrationBank } from '../data/seedGenerator';

const DB_NAME = 'blackbook_sat_db';
const DB_VERSION = 1;

/**
 * StorageAdapter interface: Decouples the persistent storage layer
 * Allows swapping between browser IndexedDB (`idb`) and Node/Electron `better-sqlite3`
 * with zero UI rewrites.
 */
export interface StorageAdapter {
  init(): Promise<void>;
  getQuestionCount(): Promise<number>;
  saveQuestions(questions: QuestionRecord[]): Promise<void>;
  getAllQuestions(): Promise<QuestionRecord[]>;
  getQuestionsByFilter(
    section?: SectionType,
    domain?: string,
    difficulty?: DifficultyLevel
  ): Promise<QuestionRecord[]>;
  saveSession(session: SessionRecord): Promise<void>;
  getAllSessions(): Promise<SessionRecord[]>;
  getSessionById(id: string): Promise<SessionRecord | undefined>;
  clearAll(): Promise<void>;
  seedInitialIfEmpty(): Promise<number>;
}

class IndexedDBStorageAdapter implements StorageAdapter {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Table: questions (mirroring SQLite schema)
        if (!db.objectStoreNames.contains('questions')) {
          const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
          questionStore.createIndex('cb_question_id', 'cb_question_id', { unique: false });
          questionStore.createIndex('section', 'section', { unique: false });
          questionStore.createIndex('domain', 'domain', { unique: false });
          questionStore.createIndex('difficulty', 'difficulty', { unique: false });
          questionStore.createIndex('format', 'format', { unique: false });
          questionStore.createIndex('section_diff', ['section', 'difficulty'], { unique: false });
        }

        // Table: sessions (mirroring SQLite schema)
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'session_id' });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Table: metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      },
    });
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async getQuestionCount(): Promise<number> {
    const db = await this.getDB();
    return await db.count('questions');
  }

  async saveQuestions(questions: QuestionRecord[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('questions', 'readwrite');
    for (const q of questions) {
      await tx.store.put(q);
    }
    await tx.done;

    // Record last sync metadata
    const metaTx = db.transaction('metadata', 'readwrite');
    await metaTx.store.put({
      key: 'last_sync',
      timestamp: Date.now(),
      total_count: await this.getQuestionCount(),
    });
    await metaTx.done;
  }

  async getAllQuestions(): Promise<QuestionRecord[]> {
    const db = await this.getDB();
    return await db.getAll('questions');
  }

  async getQuestionsByFilter(
    section?: SectionType,
    domain?: string,
    difficulty?: DifficultyLevel
  ): Promise<QuestionRecord[]> {
    const db = await this.getDB();
    let all = await db.getAll('questions');

    if (section) {
      all = all.filter(q => q.section === section);
    }
    if (domain) {
      all = all.filter(q => q.domain === domain);
    }
    if (difficulty) {
      all = all.filter(q => q.difficulty === difficulty);
    }

    return all;
  }

  async saveSession(session: SessionRecord): Promise<void> {
    const db = await this.getDB();
    await db.put('sessions', session);
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    const db = await this.getDB();
    const sessions = await db.getAllFromIndex('sessions', 'timestamp');
    return sessions.reverse(); // Newest first
  }

  async getSessionById(id: string): Promise<SessionRecord | undefined> {
    const db = await this.getDB();
    return await db.get('sessions', id);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['questions', 'sessions', 'metadata'], 'readwrite');
    await tx.objectStore('questions').clear();
    await tx.objectStore('sessions').clear();
    await tx.objectStore('metadata').clear();
    await tx.done;
  }

  async seedInitialIfEmpty(): Promise<number> {
    const count = await this.getQuestionCount();
    if (count === 0) {
      const initialBank = generateFullCalibrationBank();
      await this.saveQuestions(initialBank);
      return initialBank.length;
    }
    return count;
  }
}

// Export singleton instance of storage adapter
export const dbAdapter: StorageAdapter = new IndexedDBStorageAdapter();
