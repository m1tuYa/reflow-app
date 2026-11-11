import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "reflow.db");

declare global {
  var __reflowDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      parent_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('record','promise','done','released')),
      promise_date TEXT,
      date_undetermined INTEGER NOT NULL DEFAULT 0,
      estimate_minutes INTEGER,
      order_index INTEGER,
      started_at TEXT,
      ended_at TEXT,
      next_recall_at TEXT,
      recall_interval_days REAL NOT NULL DEFAULT 2,
      last_recalled_at TEXT,
      snoozed_until TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_state (
      date TEXT PRIMARY KEY,
      carryover_shown INTEGER NOT NULL DEFAULT 0,
      order_confirmed_at TEXT,
      recall_shown INTEGER NOT NULL DEFAULT 0,
      close_shown INTEGER NOT NULL DEFAULT 0
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      body, content='posts', content_rowid='id', tokenize='trigram'
    );

    CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
      INSERT INTO posts_fts(rowid, body) VALUES (new.id, new.body);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.id, old.body);
    END;
    CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
      INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.id, old.body);
      INSERT INTO posts_fts(rowid, body) VALUES (new.id, new.body);
    END;
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__reflowDb) {
    global.__reflowDb = createDb();
  }
  return global.__reflowDb;
}

export type Post = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  parent_id: number | null;
  status: "record" | "promise" | "done" | "released";
  promise_date: string | null;
  date_undetermined: number;
  estimate_minutes: number | null;
  order_index: number | null;
  started_at: string | null;
  ended_at: string | null;
  next_recall_at: string | null;
  recall_interval_days: number;
  last_recalled_at: string | null;
  snoozed_until: string | null;
};
