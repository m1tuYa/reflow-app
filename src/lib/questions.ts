import { getDb, Post } from "./db";
import { listOverduePromises, listTodayPromises, snooze } from "./posts";

const MORNING_CARRYOVER_CAP = 5;
const DAYTIME_RECALL_CAP = 3;

type DailyState = {
  date: string;
  carryover_shown: number;
  order_confirmed_at: string | null;
  recall_shown: number;
  close_shown: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureDailyState(date: string): DailyState {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO daily_state (date) VALUES (?)`).run(date);
  return db.prepare(`SELECT * FROM daily_state WHERE date = ?`).get(date) as DailyState;
}

function isSnoozed(post: Post): boolean {
  return !!post.snoozed_until && post.snoozed_until > new Date().toISOString();
}

export type Question =
  | { type: "when"; post: Post }
  | { type: "carryover"; post: Post }
  | { type: "morningOrder"; posts: Post[] }
  | { type: "recall"; post: Post };

// Priority per 設計書: 約束に関わる問い(when/carryover) > 確かめる日 > 止まった枝 > 過去の戻り
// (確かめる日/止まった枝 is tree-dependent, deferred to a later stage)
export function buildQueue(): Question[] {
  const db = getDb();
  const date = todayIso();
  const state = ensureDailyState(date);
  const queue: Question[] = [];

  const undetermined = (
    db
      .prepare(`SELECT * FROM posts WHERE status='promise' AND date_undetermined=1`)
      .all() as Post[]
  ).filter((p) => !isSnoozed(p));
  for (const p of undetermined) queue.push({ type: "when", post: p });

  const overdue = listOverduePromises(date).filter((p) => !isSnoozed(p));
  const carryoverRoom = Math.max(0, MORNING_CARRYOVER_CAP - state.carryover_shown);
  const shownOverdue = overdue.slice(0, carryoverRoom);
  for (const p of shownOverdue) queue.push({ type: "carryover", post: p });

  const todays = listTodayPromises(date);
  if (!state.order_confirmed_at && todays.length > 0 && overdue.length <= shownOverdue.length) {
    queue.push({ type: "morningOrder", posts: todays });
  }

  const dueRecall = (
    db
      .prepare(
        `SELECT * FROM posts WHERE next_recall_at IS NOT NULL AND next_recall_at <= ? ORDER BY next_recall_at ASC`
      )
      .all(new Date().toISOString()) as Post[]
  ).filter((p) => !isSnoozed(p));
  const recallRoom = Math.max(0, DAYTIME_RECALL_CAP - state.recall_shown);
  for (const p of dueRecall.slice(0, recallRoom)) queue.push({ type: "recall", post: p });

  return queue;
}

export function getCurrentQuestion(): { question: Question | null; remaining: number } {
  const queue = buildQueue();
  return { question: queue[0] ?? null, remaining: Math.max(0, queue.length - 1) };
}

export function markCarryoverShown(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET carryover_shown = carryover_shown + 1 WHERE date = ?`)
    .run(date);
}

export function markOrderConfirmed(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET order_confirmed_at = ? WHERE date = ?`)
    .run(new Date().toISOString(), date);
}

export function markRecallShown(): void {
  const date = todayIso();
  ensureDailyState(date);
  getDb()
    .prepare(`UPDATE daily_state SET recall_shown = recall_shown + 1 WHERE date = ?`)
    .run(date);
}

export function snoozeQuestion(question: Question): void {
  if (question.type === "morningOrder") return;
  snooze(question.post.id, 4);
}
