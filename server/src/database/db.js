import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';
import { SCHEMA_SQL } from './schema.js';

class SQLiteWrapper {
  constructor(filePath) {
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.rawDb = new DatabaseSync(filePath);
    this.inTransaction = false;
  }

  pragma(pragmaStr) {
    return this.rawDb.exec(`PRAGMA ${pragmaStr};`);
  }

  exec(sql) {
    return this.rawDb.exec(sql);
  }

  prepare(sql) {
    const stmt = this.rawDb.prepare(sql);
    return {
      run: (...params) => {
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const res = stmt.run(...args);
        return {
          changes: res.changes,
          lastInsertRowid: res.lastInsertRowid,
        };
      },
      get: (...params) => {
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.get(...args);
      },
      all: (...params) => {
        const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        return stmt.all(...args);
      },
    };
  }

  transaction(fn) {
    return (...args) => {
      this.exec('BEGIN IMMEDIATE');
      this.inTransaction = true;
      try {
        const result = fn(...args);
        this.exec('COMMIT');
        this.inTransaction = false;
        return result;
      } catch (err) {
        this.exec('ROLLBACK');
        this.inTransaction = false;
        throw err;
      }
    };
  }

  close() {
    this.rawDb.close();
  }
}

let dbInstance = null;

export function getDatabase(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || config.databasePath;
  const db = new SQLiteWrapper(targetPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Initialize schema
  db.exec(SCHEMA_SQL);

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {}
    dbInstance = null;
  }
}

export function setDatabase(customDb) {
  closeDatabase();
  dbInstance = customDb;
  return dbInstance;
}

// Dynamic proxy to guarantee all imported modules always access the active db instance
const dbProxy = new Proxy({}, {
  get(target, prop) {
    const currentDb = getDatabase();
    const val = currentDb[prop];
    if (typeof val === 'function') {
      return val.bind(currentDb);
    }
    return val;
  },
});

export default dbProxy;
