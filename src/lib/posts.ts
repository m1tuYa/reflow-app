import { getDb, Post } from "./db";
import { parsePromiseDate, parseEstimateMinutes } from "./parse";

const INITIAL_RECALL_INTERVAL_DAYS = 2;
const MIN_RECALL_INTERVAL_DAYS = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function createPost(input: {
  body: string;
  intent: "record" | "promise";
  parentId?: number | null;
}): Post {
  const db = getDb();
  const now = new Date();
  const detectedDate = parsePromiseDate(input.body, now);
  const estimateMinutes = parseEstimateMinutes(input.body);

  let status: Post["status"] = input.intent;
  let promiseDate: string | null = null;
  let dateUndetermined = 0;
  let nextRecallAt: string | null = null;

  if (input.intent === "promise") {
    if (detectedDate) {
      promiseDate = detectedDate;
    } else {
      dateUndetermined = 1; // 「いつやる?」の問いが未解決
    }
  } else {
    status = "record";
    nextRecallAt = addDaysIso(INITIAL_RECALL_INTERVAL_DAYS);
  }

  const ts = now.toISOString();
  const result = db
    .prepare(
      `INSERT INTO posts (body, created_at, updated_at, parent_id, status, promise_date, date_undetermined, estimate_minutes, next_recall_at, recall_interval_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.body,
      ts,
      ts,
      input.parentId ?? null,
      status,
      promiseDate,
      dateUndetermined,
      estimateMinutes,
      nextRecallAt,
      INITIAL_RECALL_INTERVAL_DAYS
    );

  return getPost(result.lastInsertRowid as number)!;
}

export function getPost(id: number): Post | undefined {
  return getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post | undefined;
}

export function updatePostBody(id: number, body: string): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET body = ?, updated_at = ? WHERE id = ?")
    .run(body, nowIso(), id);
  return getPost(id);
}

export function deletePost(id: number): void {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function listRecent(limit = 50): Post[] {
  return getDb()
    .prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Post[];
}

export function listTodayPromises(dateIso: string): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status IN ('promise', 'done') AND promise_date = ?
       ORDER BY order_index IS NULL, order_index ASC, created_at ASC`
    )
    .all(dateIso) as Post[];
}

export function listOverduePromises(dateIso: string): Post[] {
  return getDb()
    .prepare(
      `SELECT * FROM posts WHERE status = 'promise' AND promise_date IS NOT NULL AND promise_date < ?
       ORDER BY promise_date ASC`
    )
    .all(dateIso) as Post[];
}

export function setPromiseDate(id: number, dateIso: string | null): Post | undefined {
  getDb()
    .prepare(
      "UPDATE posts SET promise_date = ?, date_undetermined = 0, updated_at = ? WHERE id = ?"
    )
    .run(dateIso, nowIso(), id);
  return getPost(id);
}

export function reorderToday(orderedIds: number[]): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE posts SET order_index = ? WHERE id = ?");
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, idx) => stmt.run(idx, id));
  });
  tx(orderedIds);
}

export function startPromise(id: number): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET started_at = ?, updated_at = ? WHERE id = ?")
    .run(nowIso(), nowIso(), id);
  return getPost(id);
}

export function finishPromise(id: number): Post | undefined {
  getDb()
    .prepare("UPDATE posts SET ended_at = ?, status = 'done', updated_at = ? WHERE id = ?")
    .run(nowIso(), nowIso(), id);
  return getPost(id);
}

export function carryOverDecision(
  id: number,
  decision: "today" | "otherDate" | "cancel",
  otherDate?: string
): Post | undefined {
  const today = new Date().toISOString().slice(0, 10);
  if (decision === "today") return setPromiseDate(id, today);
  if (decision === "otherDate" && otherDate) return setPromiseDate(id, otherDate);
  getDb()
    .prepare("UPDATE posts SET status = 'released', updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
  return getPost(id);
}

export function recallAnswer(id: number, action: "write" | "skip", body?: string): void {
  const db = getDb();
  const post = getPost(id);
  if (!post) return;
  if (action === "skip") {
    const newInterval = post.recall_interval_days * 2;
    db.prepare(
      "UPDATE posts SET recall_interval_days = ?, next_recall_at = ?, last_recalled_at = ? WHERE id = ?"
    ).run(newInterval, addDaysIso(newInterval), nowIso(), id);
  } else {
    const newInterval = Math.max(MIN_RECALL_INTERVAL_DAYS, post.recall_interval_days / 2);
    db.prepare(
      "UPDATE posts SET recall_interval_days = ?, next_recall_at = ?, last_recalled_at = ? WHERE id = ?"
    ).run(newInterval, addDaysIso(newInterval), nowIso(), id);
    if (body) {
      createPost({ body, intent: "record", parentId: id });
    }
  }
}

export function snooze(id: number, hours = 4): void {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  getDb().prepare("UPDATE posts SET snoozed_until = ? WHERE id = ?").run(d.toISOString(), id);
}

export function search(query: string): Post[] {
  const db = getDb();
  // trigram tokenizer can't match patterns shorter than 3 chars; fall back to LIKE for those.
  if (query.length < 3) {
    return db
      .prepare(`SELECT * FROM posts WHERE body LIKE ? ORDER BY created_at DESC LIMIT 100`)
      .all(`%${query}%`) as Post[];
  }
  return db
    .prepare(
      `SELECT p.* FROM posts p JOIN posts_fts f ON f.rowid = p.id
       WHERE posts_fts MATCH ? ORDER BY p.created_at DESC LIMIT 100`
    )
    .all(query) as Post[];
}

export function allPosts(): Post[] {
  return getDb().prepare("SELECT * FROM posts ORDER BY created_at ASC").all() as Post[];
}
