import { getDb } from "./db";
import { replaceTable } from "./posts";

// 書き出し(#48): 投稿だけでなく、ルーチン・日ごとの状態・問いの記録も含める。
// 「測り方」の数値(開いた日数・問いに答えた割合など)は、この書き出しから数える。
export const BACKUP_TABLES = ["posts", "routines", "daily_state", "question_log"] as const;
type Table = (typeof BACKUP_TABLES)[number];

export type Backup = { version: 2; exported_at: string } & Record<Table, Record<string, unknown>[]>;

export function exportAll(): Backup {
  const db = getDb();
  const out = { version: 2, exported_at: new Date().toISOString() } as Backup;
  for (const t of BACKUP_TABLES) {
    out[t] = db.prepare(`SELECT * FROM ${t} ORDER BY rowid ASC`).all() as Record<string, unknown>[];
  }
  return out;
}

// 復元: 新しい形式({version:2, posts, routines, ...})と、古い形式(投稿の配列)の両方を受ける。
// 含まれている表だけ置き換える。
export function importAll(data: unknown): Record<string, number> {
  const tables: Partial<Record<Table, Record<string, unknown>[]>> = {};
  if (Array.isArray(data)) {
    tables.posts = data;
  } else if (data && typeof data === "object" && Array.isArray((data as Backup).posts)) {
    for (const t of BACKUP_TABLES) {
      const rows = (data as Record<string, unknown>)[t];
      if (Array.isArray(rows)) tables[t] = rows;
    }
  } else {
    throw new Error("書き出したJSONではありません");
  }
  const db = getDb();
  const counts: Record<string, number> = {};
  db.transaction(() => {
    for (const t of BACKUP_TABLES) {
      const rows = tables[t];
      if (!rows) continue;
      replaceTable(t, rows);
      counts[t] = rows.length;
    }
  })();
  return counts;
}
